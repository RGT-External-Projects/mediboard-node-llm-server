import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ProcessS3DocumentDto {
  @ApiProperty({
    description: 'S3 file key/path to the document to process',
    example: 'documents/medical-report.pdf',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  fileKey: string;

  @ApiProperty({
    description: 'User ID for processing context',
    example: 'user123',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Language for processing (default: en)',
    example: 'en',
    enum: ['en', 'he'],
    default: 'en',
    required: false,
  })
  @IsString()
  @IsOptional()
  language?: string;
}

export class ProcessS3DocumentResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'S3 document processing job created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Job data',
    example: {
      jobId: 'job_123456789',
      status: 'queued',
      createdAt: '2025-01-15T10:30:00Z',
      downloadMetrics: {
        duration: 1500,
        fileSize: 2048576,
      },
    },
  })
  data: {
    jobId: string;
    status: string;
    createdAt: string;
    downloadMetrics?: {
      duration: number;
      fileSize: number;
    };
  };
}
