import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import * as fs from 'fs';
import { Stream } from 'stream';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET', 'mediboard-dev');
    
    // For standard AWS S3, don't use custom endpoint
    const s3Config: any = {
      credentials: {
        accessKeyId: this.configService.get<string>('S3_KEY'),
        secretAccessKey: this.configService.get<string>('S3_SECRET'),
      },
      region: this.configService.get<string>('AWS_REGION', 'eu-central-1'),
      forcePathStyle: false, // Use false for standard AWS S3
    };

    // Only add endpoint if it's a custom S3-compatible service (not standard AWS)
    const customEndpoint = this.configService.get<string>('S3_ENDPOINT');
    if (customEndpoint && !customEndpoint.includes('amazonaws.com')) {
      s3Config.endpoint = customEndpoint;
      s3Config.forcePathStyle = true;
    }

    this.s3Client = new S3Client(s3Config);
  }

  async getPreSignedUrl(fileKey: string): Promise<string> {
    try {
      this.logger.log(`Generating presigned URL for bucket: ${this.bucket}, key: ${fileKey}`);
      
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      this.logger.log(`Generated presigned URL for file: ${fileKey} -> ${signedUrl}`);
      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for file ${fileKey}:`, error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  async downloadFile(
    url: string,
    outputPath: string
  ): Promise<{ duration: number; fileSize: number }> {
    const startTime = Date.now();

    try {
      const response = await axios.get<Stream>(url, {
        responseType: 'stream',
        timeout: 30000, // 30 second timeout
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      const stats = fs.statSync(outputPath);
      const duration = Date.now() - startTime;

      this.logger.log(`Downloaded file successfully: ${outputPath}, size: ${stats.size} bytes, duration: ${duration}ms`);

      return {
        duration,
        fileSize: stats.size,
      };
    } catch (error) {
      this.logger.error(`Failed to download file from ${url}:`, error);
      
      // Clean up partial file if it exists
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async fileExists(fileKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      // Re-throw other errors (permissions, network, etc.)
      throw error;
    }
  }

  async downloadFromS3(
    fileKey: string,
    localFilePath: string
  ): Promise<{ duration: number; fileSize: number }> {
    try {
      this.logger.log(`Starting S3 download for file: ${fileKey}`);
      
      // Check if file exists first
      const exists = await this.fileExists(fileKey);
      if (!exists) {
        throw new Error(`File does not exist in S3: ${fileKey}`);
      }
      
      const fileUrl = await this.getPreSignedUrl(fileKey);
      const downloadMetrics = await this.downloadFile(fileUrl, localFilePath);

      this.logger.log(`S3 download completed for file: ${fileKey}, metrics:`, downloadMetrics);
      
      return downloadMetrics;
    } catch (error) {
      this.logger.error(`S3 download failed for file ${fileKey}:`, error);
      throw error;
    }
  }

  async getBucketFileAsBuffer(
    fileName: string,
    binary: boolean = false
  ): Promise<any> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No file content received from S3');
      }

      // Convert the stream to buffer
      const chunks: Buffer[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      
      const originalFileName = fileName.substring(fileName.indexOf(".") + 1);
      const parts = originalFileName.split(".");
      let extension;

      if (parts.length) {
        extension = parts[parts.length - 1].toLowerCase();
      }

      const isImage = ["png", "jfif", "jpg", "jpeg", "gif"].includes(
        extension
      );

      if (binary) {
        return buffer;
      }

      if (isImage || response.ContentType === "application/octet-stream") {
        return buffer.toString("base64");
      } else {
        return buffer.toString("utf-8");
      }
    } catch (error) {
      this.logger.error(`Failed to get file as buffer: ${fileName}:`, error);
      throw error;
    }
  }
}
