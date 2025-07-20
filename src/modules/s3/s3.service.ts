import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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
    this.bucket = this.configService.get<string>('S3_BUCKET');
    
    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: this.configService.get<string>('S3_KEY'),
        secretAccessKey: this.configService.get<string>('S3_SECRET'),
      },
      endpoint: this.configService.get<string>('S3_ENDPOINT'),
      region: this.configService.get<string>('AWS_REGION', 'eu-central-1'),
      forcePathStyle: this.configService.get<boolean>('S3_FORCE_PATH_STYLE', true),
    });
  }

  async getPreSignedUrl(fileKey: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      this.logger.log(`Generated presigned URL for file: ${fileKey}`);
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

  async downloadFromS3(
    fileKey: string,
    localFilePath: string
  ): Promise<{ duration: number; fileSize: number }> {
    try {
      this.logger.log(`Starting S3 download for file: ${fileKey}`);
      
      const fileUrl = await this.getPreSignedUrl(fileKey);
      const downloadMetrics = await this.downloadFile(fileUrl, localFilePath);

      this.logger.log(`S3 download completed for file: ${fileKey}, metrics:`, downloadMetrics);
      
      return downloadMetrics;
    } catch (error) {
      this.logger.error(`S3 download failed for file ${fileKey}:`, error);
      throw error;
    }
  }
}
