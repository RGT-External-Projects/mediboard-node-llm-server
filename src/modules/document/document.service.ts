import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  DocumentProcessingData,
  ProcessingStatus,
  ProcessingMetrics,
  QUEUE_NAMES,
  JOB_TYPES,
} from '../../types';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.MEDICAL_PROCESSING)
    private medicalQueue: Queue,
    private configService: ConfigService,
  ) {}

  async queueDocumentProcessing(request: {
    file: Express.Multer.File;
    userId: string;
    language: string;
  }): Promise<{ jobId: string; status: string }> {
    try {
      const jobId = request.userId;
      const uploadPath = this.configService.get('UPLOAD_PATH', './uploads');

      // Ensure upload directory exists
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      // Save file to permanent location
      const fileName = `${jobId}_${request.file.originalname}`;
      const filePath = path.join(uploadPath, fileName);

      // Move file from temp location to permanent location
      fs.renameSync(request.file.path, filePath);

      const jobData: DocumentProcessingData = {
        jobId,
        filePath,
        fileName: request.file.originalname,
        userId: request.userId,
        language: request.language,
        uploadedAt: new Date(),
      };

      // Add job to medical processing queue
      const job = await this.medicalQueue.add(JOB_TYPES.PROCESS_DOCUMENT, jobData, {
        jobId,
        delay: 0,
        attempts: this.configService.get('MAX_RETRY_ATTEMPTS', 3),
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(`Document processing job queued: ${jobId} for file: ${fileName}`);

      return {
        jobId,
        status: 'queued',
      };
    } catch (error) {
      this.logger.error('Failed to queue document processing:', error);
      throw error;
    }
  }

  async getProcessingStatus(jobId: string): Promise<ProcessingStatus | null> {
    try {
      // Get all jobs from the medical queue
      const allJobs = await this.medicalQueue.getJobs([
        'waiting',
        'active',
        'completed',
        'failed',
      ]);

      // Find the main document processing job
      const documentJob = allJobs.find(
        (job) => job.data.jobId === jobId && job.name === JOB_TYPES.PROCESS_DOCUMENT,
      );

      if (!documentJob) {
        return null;
      }

      // Since all processing is now done in one job, we just need to check the main job
      const jobProgress = documentJob.progress();
      const isCompleted = documentJob.finishedOn !== null;
      const isActive = documentJob.processedOn !== null && !isCompleted;

      // Calculate progress based on job progress
      const progressValue = typeof jobProgress === 'number' ? jobProgress : 0;
      const progress = {
        documentSummary: progressValue >= 25,
        physicianMatching: progressValue >= 50,
        facilityMatching: progressValue >= 65,
        labParameterMatching: {
          total: 1,
          completed: progressValue >= 90 ? 1 : 0,
          percentage: progressValue >= 90 ? 100 : 0,
        },
      };

      // Collect results from the single job
      const results: any = {};
      if (documentJob.finishedOn && documentJob.returnvalue) {
        const jobResult = documentJob.returnvalue;
        if (jobResult.data) {
          results.summary = jobResult.data.summary;
          results.physicianMatch = jobResult.data.physicianMatch;
          results.facilityMatch = jobResult.data.facilityMatch;
          results.labMatches = jobResult.data.labMatches;
        }
      }

      const status: ProcessingStatus = {
        jobId,
        status: this.getOverallStatus(documentJob, []),
        progress,
        results: Object.keys(results).length > 0 ? results : undefined,
        error: documentJob.failedReason || undefined,
        createdAt: new Date(documentJob.timestamp),
        updatedAt: new Date(documentJob.processedOn || documentJob.timestamp),
      };

      return status;
    } catch (error) {
      this.logger.error(`Failed to get processing status for job ${jobId}:`, error);
      throw error;
    }
  }

  private getOverallStatus(mainJob: Job, relatedJobs: Job[]): ProcessingStatus['status'] {
    if (mainJob.failedReason || relatedJobs.some((job) => job.failedReason)) {
      return 'failed';
    }

    if (mainJob.finishedOn && relatedJobs.every((job) => job.finishedOn)) {
      return 'completed';
    }

    if (mainJob.processedOn || relatedJobs.some((job) => job.processedOn)) {
      return 'active';
    }

    return 'waiting';
  }

  async getProcessingResults(jobId: string): Promise<any | null> {
    try {
      const status = await this.getProcessingStatus(jobId);

      if (!status || status.status !== 'completed') {
        return null;
      }

      return status.results;
    } catch (error) {
      this.logger.error(`Failed to get processing results for job ${jobId}:`, error);
      throw error;
    }
  }

  async getResultStructure(jobId: string): Promise<any | null> {
    try {
      const status = await this.getProcessingStatus(jobId);

      if (!status || status.status !== 'completed') {
        return null;
      }

      const results = status.results;
      if (!results) {
        return null;
      }

      // Get job details for additional metadata
      const allJobs = await this.medicalQueue.getJobs([
        'waiting',
        'active',
        'completed',
        'failed',
      ]);

      const documentJob = allJobs.find(
        (job) => job.data.jobId === jobId && job.name === JOB_TYPES.PROCESS_DOCUMENT,
      );

      // Extract data from the results
      const documentData = results.summary?.data || results.summary || {};
      const physicianData = results.physicianMatch?.data || {};
      const institutionData = results.facilityMatch?.data || {};
      const labReportsData = results.labMatches || [];

      // Transform lab reports data
      const transformedLabReports = labReportsData
        // Filter out reports that don't have test_params structure
        .filter((report: any) => report.data?.test_params?.name != null && report.data?.test_params?.name.trim() !== '')
        // Sort lab reports by their index property in ascending order (lowest to highest)
        .sort((a: any, b: any) => {
          const indexA = a.data?.test_params?.index ?? a.data?.index ?? 0;
          const indexB = b.data?.test_params?.index ?? b.data?.index ?? 0;
          return parseInt(indexA) - parseInt(indexB);
        })
        .map((report: any) => {
          const reportData = report.data || report;
          const testParams = reportData.test_params || {};
          
          // Handle negative_positive value type
          if (
            (testParams.result_value_type === "negative_positive" || 
             reportData.parameter_value_type === "negative_positive") && 
            testParams.result
          ) {
            const result = String(testParams.result).toLowerCase();
            if (result.includes("positive")) {
              testParams.result = "positive";
            } else if (result.includes("negative")) {
              testParams.result = "negative";
            } else {
              testParams.result = null;
            }
          }
          
          return {
            test_params: testParams,
            match_data: {
              id: reportData.matched_id === 0 ? null : reportData.matched_id,
              matched_parameter: reportData.matched_parameter,
            },
            match_info: reportData.match_info,
            parameter_value_type: testParams.result_value_type || reportData.parameter_value_type || "",
          };
        });

      // Build structured response
      const structuredData = {
        job_info: {
          job_id: jobId,
          user_id: documentJob?.data?.userId ?? null,
          file_name: documentJob?.data?.fileName ?? null,
          status: status.status,
        },
        patient_info: {
          first_name: documentData?.patient_info?.first_name ?? null,
          last_name: documentData?.patient_info?.last_name ?? null,
        },
        physician_info: {
          first_name: documentData?.physician_info?.first_name ?? null,
          last_name: documentData?.physician_info?.last_name ?? null,
          match_data: {
            id: physicianData.matched_id === 0 ? null : physicianData.matched_id,
            title: physicianData.matched_title,
            name: physicianData.matched_name,
            lastname: physicianData.matched_lastname,
          },
          match_info: physicianData.match_info,
        },
        medical_facility: {
          facility_name: documentData?.medical_facility?.facility_name ?? null,
          location: documentData?.medical_facility?.location ?? null,
          match_data: {
            id: institutionData.matched_id === 0 ? null : institutionData.matched_id,
            value: institutionData.value_name,
            displayName: institutionData.matched_display_name,
          },
          match_info: institutionData.match_info,
        },
        lab_reports: transformedLabReports,
        is_lab_report: documentData.is_lab_report,
        test_date: documentData?.test_date ?? null,
      };

      return structuredData;
    } catch (error) {
      this.logger.error(`Failed to get structured results for job ${jobId}:`, error);
      throw error;
    }
  }

  async listJobs(filters: {
    status?: string;
    userId?: string;
    limit: number;
    offset: number;
  }): Promise<{ jobs: ProcessingStatus[]; total: number }> {
    try {
      const { status, userId, limit, offset } = filters;

      // Get jobs from medical processing queue
      const allStates = ['waiting', 'active', 'completed', 'failed', 'delayed'];
      const states = status ? [status] : allStates;

      const jobs = await this.medicalQueue.getJobs(
        states as any,
        offset,
        offset + limit - 1,
      );

      // Filter for document processing jobs only
      const documentJobs = jobs.filter((job) => job.name === JOB_TYPES.PROCESS_DOCUMENT);

      // Filter by userId if provided
      const filteredJobs = userId
        ? documentJobs.filter((job) => job.data.userId === userId)
        : documentJobs;

      // Convert to ProcessingStatus
      const statusPromises = filteredJobs.map((job) =>
        this.getProcessingStatus(job.data.jobId),
      );
      const statuses = (await Promise.all(statusPromises)).filter(
        Boolean,
      ) as ProcessingStatus[];

      // Get total count
      const totalCounts = await this.medicalQueue.getJobCounts();
      const total = Object.values(totalCounts).reduce(
        (sum: number, count: number) => sum + count,
        0,
      );

      return {
        jobs: statuses,
        total,
      };
    } catch (error) {
      this.logger.error('Failed to list jobs:', error);
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Get all jobs related to this jobId
      const allJobs = await this.medicalQueue.getJobs(['waiting', 'active']);
      const relatedJobs = allJobs.filter((job) => job.data.jobId === jobId);

      if (relatedJobs.length === 0) {
        return false;
      }

      // Cancel all related jobs
      for (const job of relatedJobs) {
        await job.remove();
      }

      this.logger.log(
        `Job ${jobId} and ${relatedJobs.length} related jobs cancelled successfully`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      throw error;
    }
  }

  async getProcessingMetrics(): Promise<ProcessingMetrics> {
    try {
      const counts = await this.medicalQueue.getJobCounts();

      const queueHealth: ProcessingMetrics['queueHealth'] = {
        [QUEUE_NAMES.MEDICAL_PROCESSING]: {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
        },
      };

      const totalJobs = Object.values(counts).reduce(
        (sum: number, count: number) => sum + count,
        0,
      );
      const completedJobs = counts.completed || 0;
      const failedJobs = counts.failed || 0;

      // Calculate average processing time (simplified)
      const recentCompletedJobs = await this.medicalQueue.getJobs(['completed'], 0, 99);
      const processingTimes = recentCompletedJobs
        .filter((job) => job.finishedOn && job.processedOn)
        .map((job) => job.finishedOn! - job.processedOn!);

      const averageProcessingTime =
        processingTimes.length > 0
          ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
          : 0;

      return {
        totalJobs,
        completedJobs,
        failedJobs,
        averageProcessingTime,
        queueHealth,
      };
    } catch (error) {
      this.logger.error('Failed to get processing metrics:', error);
      throw error;
    }
  }

  async getHealthStatus(): Promise<any> {
    try {
      const metrics = await this.getProcessingMetrics();

      return {
        service: 'Document Processing Service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics,
        queues: {
          [QUEUE_NAMES.MEDICAL_PROCESSING]: await this.medicalQueue.getJobCounts(),
        },
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        service: 'Document Processing Service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  async generateLabReportsCsv(jobId: string): Promise<string | null> {
    try {
      const structuredResults = await this.getResultStructure(jobId);

      if (!structuredResults || !structuredResults.lab_reports) {
        return null;
      }

      const labReports = structuredResults.lab_reports;

      // CSV header with 10 columns as specified
      const headers = 'Parameter,Result,Unit,Range,comment,Parameter Matched,Result,Unit,Range,comment';
      
      // Generate CSV rows
      const rows = labReports.map((report: any) => {
        const testParams = report.test_params || {};
        const matchData = report.match_data || {};

        // Create row with 6 populated columns + 4 empty columns
        const row = [
          this.escapeCsvValue(testParams.name || ''),
          this.escapeCsvValue(testParams.result || ''),
          this.escapeCsvValue(testParams.units || ''),
          this.escapeCsvValue(testParams.range || ''),
          this.escapeCsvValue(testParams.comment || testParams.comment_english || ''),
          this.escapeCsvValue(matchData.matched_parameter || ''),
          '', // Empty Result column
          '', // Empty Unit column
          '', // Empty Range column
          ''  // Empty comment column
        ];

        return row.join(',');
      });

      // Combine header and rows
      const csvContent = [headers, ...rows].join('\n');

      this.logger.log(`Generated CSV for job ${jobId} with ${labReports.length} lab reports`);
      return csvContent;
    } catch (error) {
      this.logger.error(`Failed to generate CSV for job ${jobId}:`, error);
      throw error;
    }
  }

  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);
    
    // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  async generateWebhookPayload(jobId: string, rawResults: any): Promise<any | null> {
    try {
      // Get job details for metadata
      const allJobs = await this.medicalQueue.getJobs([
        'waiting',
        'active',
        'completed',
        'failed',
      ]);

      const documentJob = allJobs.find(
        (job) => job.data.jobId === jobId && job.name === JOB_TYPES.PROCESS_DOCUMENT,
      );

      if (!documentJob) {
        this.logger.warn(`Job not found for webhook payload generation: ${jobId}`);
        return null;
      }

      // Extract data from the raw results (same structure as in getResultStructure)
      const documentData = rawResults.summary?.data || rawResults.summary || {};
      const physicianData = rawResults.physicianMatch?.data || {};
      const institutionData = rawResults.facilityMatch?.data || {};
      const labReportsData = rawResults.labMatches || [];

      // Transform lab reports data (same logic as getResultStructure)
      const transformedLabReports = labReportsData
        // Filter out reports that don't have test_params structure
        .filter((report: any) => report.data?.test_params?.name != null && report.data?.test_params?.name.trim() !== '')
        // Sort lab reports by their index property in ascending order (lowest to highest)
        .sort((a: any, b: any) => {
          const indexA = a.data?.test_params?.index ?? a.data?.index ?? 0;
          const indexB = b.data?.test_params?.index ?? b.data?.index ?? 0;
          return parseInt(indexA) - parseInt(indexB);
        })
        .map((report: any) => {
          const reportData = report.data || report;
          const testParams = reportData.test_params || {};
          
          // Handle negative_positive value type
          if (
            (testParams.result_value_type === "negative_positive" || 
             reportData.parameter_value_type === "negative_positive") && 
            testParams.result
          ) {
            const result = String(testParams.result).toLowerCase();
            if (result.includes("positive")) {
              testParams.result = "positive";
            } else if (result.includes("negative")) {
              testParams.result = "negative";
            } else {
              testParams.result = null;
            }
          }
          
          return {
            test_params: testParams,
            match_data: {
              id: reportData.matched_id === 0 ? null : reportData.matched_id,
              matched_parameter: reportData.matched_parameter,
            },
            match_info: reportData.match_info,
            parameter_value_type: testParams.result_value_type || reportData.parameter_value_type || "",
          };
        });

      // Build structured webhook payload (same structure as getResultStructure)
      const webhookData = {
        job_info: {
          job_id: jobId,
          user_id: documentJob.data.userId,
          file_name: documentJob.data.fileName,
          status: 'completed',
        },
        patient_info: {
          first_name: documentData?.patient_info?.first_name ?? null,
          last_name: documentData?.patient_info?.last_name ?? null,
        },
        physician_info: {
          first_name: documentData?.physician_info?.first_name ?? null,
          last_name: documentData?.physician_info?.last_name ?? null,
          match_data: {
            id: physicianData.matched_id === 0 ? null : physicianData.matched_id,
            title: physicianData.matched_title,
            name: physicianData.matched_name,
            lastname: physicianData.matched_lastname,
          },
          match_info: physicianData.match_info,
        },
        medical_facility: {
          facility_name: documentData?.medical_facility?.facility_name ?? null,
          location: documentData?.medical_facility?.location ?? null,
          match_data: {
            id: institutionData.matched_id === 0 ? null : institutionData.matched_id,
            value: institutionData.value_name,
            displayName: institutionData.matched_display_name,
          },
          match_info: institutionData.match_info,
        },
        lab_reports: transformedLabReports,
        is_lab_report: documentData.is_lab_report,
        test_date: documentData?.test_date ?? null,
      };

      return webhookData;
    } catch (error) {
      this.logger.error(`Failed to generate webhook payload for job ${jobId}:`, error);
      return null;
    }
  }
}
