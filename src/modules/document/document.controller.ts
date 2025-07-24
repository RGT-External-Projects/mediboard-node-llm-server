import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpStatus,
  HttpException,
  UsePipes,
  ValidationPipe,
  Response,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiConsumes, 
  ApiParam, 
  ApiQuery,
  ApiBody,
  getSchemaPath,
} from '@nestjs/swagger';
import { DocumentService } from './document.service';
import {
  ProcessDocumentDto,
  ProcessDocumentResponseDto,
  ProcessS3DocumentDto,
  ProcessS3DocumentResponseDto,
  ProcessingStatusResponseDto,
  JobListQueryDto,
  JobListResponseDto,
  ApiResponseDto,
  ErrorResponseDto,
  ValidationErrorResponseDto,
  UpdateLabParametersDto,
  UpdateDoctorsDto,
  UpdateInstitutesDto,
} from './dto';

@ApiTags('documents')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('process')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, PNG, JPG, and JPEG files are allowed.'), false);
      }
    },
  }))
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ 
    summary: 'Upload and process a medical document',
    description: 'Upload a medical document (PDF, PNG, JPG, JPEG) for AI-powered processing. The document will be analyzed to extract patient information, physician details, medical facility information, and lab test results with parameter matching.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Medical document upload with processing parameters',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Medical document file (PDF, PNG, JPG, JPEG, max 10MB)',
        },
        userId: {
          type: 'string',
          description: 'User ID for processing context',
          example: 'user123',
        },
        language: {
          type: 'string',
          description: 'Processing language (default: en)',
          enum: ['en', 'he'],
          default: 'en',
        },
      },
      required: ['file', 'userId'],
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Document processing job created successfully',
    type: ProcessDocumentResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Document processing job created successfully',
        data: {
          jobId: 'job_123456789',
          status: 'waiting',
          createdAt: '2025-01-15T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid file or request parameters',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Invalid file type. Only PDF, PNG, JPG, and JPEG files are allowed.',
        statusCode: 400,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/process',
      },
    },
  })
  @ApiResponse({ 
    status: 413, 
    description: 'File too large (max 10MB)',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'File size exceeds the 10MB limit',
        statusCode: 413,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/process',
      },
    },
  })
  @ApiResponse({ 
    status: 422, 
    description: 'Validation error',
    type: ValidationErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Validation failed',
        statusCode: 422,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/process',
        errors: ['userId should not be empty', 'file must be provided'],
      },
    },
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Failed to queue document processing: Service temporarily unavailable',
        statusCode: 500,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/process',
      },
    },
  })
  async processDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { userId: string; language?: string },
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    if (!body.userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.documentService.queueDocumentProcessing({
        file,
        userId: body.userId,
        language: body.language || 'en',
      });

      return {
        success: true,
        message: 'Document processing job created successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to queue document processing: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('process-s3')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ 
    summary: 'Process a medical document from S3',
    description: 'Process a medical document stored in S3 for AI-powered processing. The document will be downloaded from S3 and analyzed to extract patient information, physician details, medical facility information, and lab test results with parameter matching.',
  })
  @ApiBody({
    description: 'S3 document processing parameters',
    type: ProcessS3DocumentDto,
    schema: {
      type: 'object',
      properties: {
        fileKey: {
          type: 'string',
          description: 'S3 file key/path to the document to process',
          example: 'documents/medical-report.pdf',
        },
        userId: {
          type: 'string',
          description: 'User ID for processing context',
          example: 'user123',
        },
        language: {
          type: 'string',
          description: 'Processing language (default: en)',
          enum: ['en', 'he'],
          default: 'en',
        },
      },
      required: ['fileKey', 'userId'],
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'S3 document processing job created successfully',
    type: ProcessS3DocumentResponseDto,
    schema: {
      example: {
        success: true,
        message: 'S3 document processing job created successfully',
        data: {
          jobId: 'job_123456789',
          status: 'queued',
          createdAt: '2025-01-15T10:30:00Z',
          downloadMetrics: {
            duration: 1500,
            fileSize: 2048576,
          },
        },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid S3 file key or request parameters',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'File type .txt is not allowed. Only PDF and image files are supported.',
        statusCode: 400,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/process-s3',
      },
    },
  })
  @ApiResponse({ 
    status: 413, 
    description: 'File too large (max 10MB)',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'File size (15728640 bytes) exceeds the 10MB limit',
        statusCode: 413,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/process-s3',
      },
    },
  })
  @ApiResponse({ 
    status: 404, 
    description: 'S3 file not found',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Failed to queue S3 document processing: Failed to generate presigned URL: NoSuchKey',
        statusCode: 404,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/process-s3',
      },
    },
  })
  @ApiResponse({ 
    status: 422, 
    description: 'Validation error',
    type: ValidationErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Validation failed',
        statusCode: 422,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/process-s3',
        errors: ['fileKey should not be empty', 'userId should not be empty'],
      },
    },
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Failed to queue S3 document processing: S3 service temporarily unavailable',
        statusCode: 500,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/process-s3',
      },
    },
  })
  async processS3Document(
    @Body() body: ProcessS3DocumentDto,
  ) {
    try {
      const result = await this.documentService.queueS3DocumentProcessing({
        fileKey: body.fileKey,
        userId: body.userId,
        language: body.language || 'en',
      });

      return {
        success: true,
        message: 'S3 document processing job created successfully',
        data: {
          jobId: result.jobId,
          status: result.status,
          createdAt: new Date().toISOString(),
          downloadMetrics: result.downloadMetrics,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Failed to queue S3 document processing: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('status/:jobId')
  @ApiOperation({ 
    summary: 'Get processing status for a job',
    description: 'Retrieve the current processing status and progress for a specific job. Returns detailed information about each processing stage including document summary, physician matching, facility matching, and lab parameter matching progress.',
  })
  @ApiParam({ 
    name: 'jobId', 
    description: 'Unique job identifier returned from the process endpoint',
    example: 'job_123456789',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Job status retrieved successfully',
    type: ProcessingStatusResponseDto,
    schema: {
      example: {
        success: true,
        data: {
          jobId: 'job_123456789',
          status: 'active',
          progress: {
            documentSummary: true,
            physicianMatching: true,
            facilityMatching: false,
            labParameterMatching: {
              total: 25,
              completed: 15,
              percentage: 60,
            },
          },
          results: {
            summary: { /* document summary data */ },
            physicianMatch: { /* physician match data */ },
          },
          createdAt: '2025-01-15T10:30:00Z',
          updatedAt: '2025-01-15T10:33:00Z',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Job not found',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Job not found',
        statusCode: 404,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/status/job_123456789',
      },
    },
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async getProcessingStatus(@Param('jobId') jobId: string) {
    try {
      const status = await this.documentService.getProcessingStatus(jobId);
      
      if (!status) {
        throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get job status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('results/:jobId')
  @ApiOperation({ summary: 'Get final processing results for a completed job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to get results for' })
  @ApiResponse({ status: 200, description: 'Job results retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found or not completed' })
  async getProcessingResults(@Param('jobId') jobId: string) {
    try {
      const results = await this.documentService.getProcessingResults(jobId);
      
      if (!results) {
        throw new HttpException('Job not found or not completed', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get job results: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('result_structure/:jobId')
  @ApiOperation({ 
    summary: 'Get structured processing results for a completed job',
    description: 'Returns processed medical document data in a structured format with matched entities and filtered lab reports. Lab reports are filtered to exclude empty parameters and sorted by index in ascending order. Negative/positive results are normalized to "positive", "negative", or null values.',
  })
  @ApiParam({ 
    name: 'jobId', 
    description: 'Job ID to get structured results for',
    example: 'job_123456789',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Structured job results retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          job_info: {
            job_id: "job_123456789",
            user_id: "user123",
            file_name: "lab_report.pdf",
            status: "completed"
          },
          patient_info: {
            first_name: "John",
            last_name: "Doe"
          },
          physician_info: {
            first_name: "Jane",
            last_name: "Smith",
            match_data: {
              id: 657,
              title: "Dr.",
              name: "Jane",
              lastname: "Smith"
            },
            match_info: {
              match_score: "Exact",
              reason: "Perfect match found"
            }
          },
          medical_facility: {
            facility_name: "Mayo Clinic",
            location: "Rochester, MN",
            match_data: {
              id: 57,
              value: "Mayo Clinic",
              displayName: "Mayo Clinic Health System"
            },
            match_info: {
              match_score: "Exact",
              reason: "Perfect match found"
            }
          },
          lab_reports: [
            {
              test_params: {
                index: "1",
                name: "Glucose (B)",
                result_value_type: "numeric_value",
                result: 103,
                range: "70-100",
                units: "mg/dl",
                test_type: "Metabolic Panel",
                comment: null,
                comment_english: null
              },
              match_data: {
                id: 397,
                matched_parameter: "Glucose (Glu) - blood"
              },
              match_info: {
                match_score: "Similar; Typo",
                reason: "Minor variation in naming"
              },
              parameter_value_type: "numeric_value"
            }
          ],
          is_lab_report: true,
          test_date: "2023-01-15"
        }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Job not found or not completed',
    schema: {
      example: {
        success: false,
        message: 'Job not found or not completed',
        statusCode: 404,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/result_structure/job_123456789',
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    schema: {
      example: {
        success: false,
        message: 'Failed to get structured results: Processing error',
        statusCode: 500,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/result_structure/job_123456789',
      }
    }
  })
  async getResultStructure(@Param('jobId') jobId: string) {
    try {
      const results = await this.documentService.getResultStructure(jobId);
      
      if (!results) {
        throw new HttpException('Job not found or not completed', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get structured results: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List processing jobs with optional filtering' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by job status' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination' })
  @ApiResponse({ status: 200, description: 'Jobs list retrieved successfully' })
  async listJobs(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      const jobs = await this.documentService.listJobs({
        status,
        userId,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
      });

      return {
        success: true,
        data: jobs,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to list jobs: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('jobs/:jobId')
  @ApiOperation({ summary: 'Cancel a processing job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to cancel' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async cancelJob(@Param('jobId') jobId: string) {
    try {
      const result = await this.documentService.cancelJob(jobId);
      
      if (!result) {
        throw new HttpException('Job not found or cannot be cancelled', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'Job cancelled successfully',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to cancel job: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get processing metrics and queue health' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics() {
    try {
      const metrics = await this.documentService.getProcessingMetrics();

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async healthCheck() {
    try {
      const health = await this.documentService.getHealthStatus();

      return {
        success: true,
        data: health,
      };
    } catch (error) {
      throw new HttpException(
        `Health check failed: ${error.message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('csv/:jobId')
  @ApiOperation({ 
    summary: 'Export lab reports as CSV',
    description: 'Export lab reports from a completed job as a CSV file. The CSV includes parameter details and matching information in the format: Parameter, Result, Unit, Range, comment, Parameter Matched, followed by 4 empty columns for additional data entry.',
  })
  @ApiParam({ 
    name: 'jobId', 
    description: 'Job ID to export lab reports for',
    example: 'job_123456789',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'CSV file generated successfully',
    headers: {
      'Content-Type': {
        description: 'MIME type of the response',
        schema: { type: 'string', example: 'text/csv' }
      },
      'Content-Disposition': {
        description: 'Attachment header for file download',
        schema: { type: 'string', example: 'attachment; filename="lab_report_job_123456789.csv"' }
      }
    },
    schema: {
      type: 'string',
      format: 'binary',
      example: 'Parameter,Result,Unit,Range,comment,Parameter Matched,Result,Unit,Range,comment\nRBC,4.5,10e6/µL,3.8 - 5.1,,RBC - blood,,,,'
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Job not found, not completed, or no lab reports available',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Job not found or not completed',
        statusCode: 404,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/csv/job_123456789',
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Failed to generate CSV: Processing error',
        statusCode: 500,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/csv/job_123456789',
      }
    }
  })
  async exportLabReportsCsv(@Param('jobId') jobId: string, @Response() res: any) {
    try {
      const csvContent = await this.documentService.generateLabReportsCsv(jobId);
      
      if (!csvContent) {
        throw new HttpException('Job not found, not completed, or no lab reports available', HttpStatus.NOT_FOUND);
      }

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="lab_report_${jobId}.csv"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');

      // Send CSV content
      res.send(csvContent);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to generate CSV: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('markdown/:jobId')
  @ApiOperation({ 
    summary: 'Export document markdown content',
    description: 'Export the original markdown content extracted from a completed job as a downloadable .md file. This provides access to the raw document content that was processed by the LlamaParseReader.',
  })
  @ApiParam({ 
    name: 'jobId', 
    description: 'Job ID to export markdown content for',
    example: 'job_123456789',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Markdown file generated successfully',
    headers: {
      'Content-Type': {
        description: 'MIME type of the response',
        schema: { type: 'string', example: 'text/markdown' }
      },
      'Content-Disposition': {
        description: 'Attachment header for file download',
        schema: { type: 'string', example: 'attachment; filename="document_job_123456789.md"' }
      }
    },
    schema: {
      type: 'string',
      format: 'binary',
      example: '# Document Title\n\nThis is the markdown content extracted from the document...'
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Job not found, not completed, or no markdown content available',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Job not found, not completed, or no markdown content available',
        statusCode: 404,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/markdown/job_123456789',
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Failed to retrieve markdown content: Processing error',
        statusCode: 500,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/markdown/job_123456789',
      }
    }
  })
  async exportMarkdownContent(@Param('jobId') jobId: string, @Response() res: any) {
    try {
      const markdownContent = await this.documentService.getMarkdownContent(jobId);
      
      if (!markdownContent) {
        throw new HttpException('Job not found, not completed, or no markdown content available', HttpStatus.NOT_FOUND);
      }

      // Set headers for markdown download
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="document_${jobId}.md"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');

      // Send markdown content
      res.send(markdownContent);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to retrieve markdown content: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('vector-stores/lab-parameters')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ 
    summary: 'Update lab parameters vector store',
    description: 'Add new lab parameters to the vector store for improved matching during document processing. This endpoint allows you to expand the database of known lab parameters.',
  })
  @ApiBody({
    description: 'Lab parameters to add to the vector store',
    type: UpdateLabParametersDto,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lab parameters updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Lab parameters updated successfully',
        data: {
          status: true,
          message: 'Lab parameters updated successfully',
          data: true,
        },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid lab parameters format',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Invalid parameter format. Expected: {id: number, parameter: string}',
        statusCode: 400,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/vector-stores/lab-parameters',
      },
    },
  })
  @ApiResponse({ 
    status: 422, 
    description: 'Validation error',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async updateLabParameters(@Body() body: UpdateLabParametersDto) {
    try {
      const result = await this.documentService.updateLabParameters(body.parameters);

      return {
        success: true,
        message: 'Lab parameters updated successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to update lab parameters: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('vector-stores/doctors')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ 
    summary: 'Update doctors vector store',
    description: 'Add new doctors to the vector store for improved physician matching during document processing. This endpoint allows you to expand the database of known doctors.',
  })
  @ApiBody({
    description: 'Doctors to add to the vector store',
    type: UpdateDoctorsDto,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Doctors updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctors updated successfully',
        data: {
          status: true,
          message: 'Doctors updated successfully',
          data: true,
        },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid doctors format',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Invalid doctor format. Expected: {id: number, doctorName: string, doctorLastName: string}',
        statusCode: 400,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/vector-stores/doctors',
      },
    },
  })
  @ApiResponse({ 
    status: 422, 
    description: 'Validation error',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async updateDoctors(@Body() body: UpdateDoctorsDto) {
    try {
      const result = await this.documentService.updateDoctors(body.doctors);

      return {
        success: true,
        message: 'Doctors updated successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to update doctors: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('vector-stores/institutes')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ 
    summary: 'Update institutes vector store',
    description: 'Add new medical institutes/facilities to the vector store for improved facility matching during document processing. This endpoint allows you to expand the database of known medical facilities.',
  })
  @ApiBody({
    description: 'Institutes to add to the vector store',
    type: UpdateInstitutesDto,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Institutes updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Institutes updated successfully',
        data: {
          status: true,
          message: 'Institutes updated successfully',
          data: true,
        },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid institutes format',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Invalid institute format. Expected: {id: number, value: string, displayName?: string}',
        statusCode: 400,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/documents/vector-stores/institutes',
      },
    },
  })
  @ApiResponse({ 
    status: 422, 
    description: 'Validation error',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async updateInstitutes(@Body() body: UpdateInstitutesDto) {
    try {
      const result = await this.documentService.updateInstitutes(body.institutes);

      return {
        success: true,
        message: 'Institutes updated successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to update institutes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
