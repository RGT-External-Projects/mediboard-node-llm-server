import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { LangChainService } from '../../langchain/langchain.service';
import { WebhookService, WebhookPayload } from '../../webhook/webhook.service';
import { DocumentService } from '../../document/document.service';
import {
  DocumentProcessingData,
  QUEUE_NAMES,
  JOB_TYPES,
  JobResult,
} from '../../../types';
import { DiscordNotificationService } from '../../notification/discord-notification.service';

@Processor(QUEUE_NAMES.MEDICAL_PROCESSING)
export class MedicalProcessor {
  private readonly logger = new Logger(MedicalProcessor.name);

  constructor(
    private readonly langChainService: LangChainService,
    private readonly webhookService: WebhookService,
    private readonly documentService: DocumentService,
    private readonly discordNotificationService: DiscordNotificationService,
  ) {}

  @Process(JOB_TYPES.PROCESS_DOCUMENT)
  async processDocument(job: Job<DocumentProcessingData>): Promise<JobResult> {
    const startTime = Date.now();
    const { jobId, filePath, fileName, userId, language } = job.data;

    try {
      this.logger.log(
        `Starting complete document processing for job: ${jobId}, file: ${fileName}`,
      );

      // Update job progress
      await job.progress(5);

      // Wait for LangChain service to be initialized before processing
      await this.waitForLangChainInitialization();

      // Step 1: Get document summary and extraction
      this.logger.log(`Processing document summary for: ${fileName}`);
      const documentSummary = await this.langChainService.getDocumentSummary({
        filePath,
        userId,
        language,
      });

      if (!documentSummary.status) {
        const errorMessage =
          documentSummary.error || 'Unknown error occurred during document processing';
        throw new Error(`Document summary failed: ${errorMessage}`);
      }

      await job.progress(25);
      this.logger.log(`Document summary completed for: ${fileName}`);

      // Extract structured data from the summary
      const extractedData = documentSummary.data;
      await job.progress(35);

      // Step 2: Process physician matching directly (no sub-queue)
      let physicianMatch = null;
      if (extractedData.physician_info) {
        this.logger.log(`Processing physician matching for job: ${jobId}`);
        try {
          physicianMatch = await this.langChainService.matchPhysician({
            physicianInfo: extractedData.physician_info,
            userId,
            language,
          });
          this.logger.log(`Physician matching completed for job: ${jobId}`);
        } catch (error) {
          this.logger.warn(`Physician matching failed for job: ${jobId}:`, error);
        }
      }
      await job.progress(50);

      // Step 3: Process facility matching directly (no sub-queue)
      let facilityMatch = null;
      if (extractedData.medical_facility) {
        this.logger.log(`Processing facility matching for job: ${jobId}`);
        try {
          facilityMatch = await this.langChainService.matchFacility({
            facilityInfo: extractedData.medical_facility,
            userId,
            language,
          });
          this.logger.log(`Facility matching completed for job: ${jobId}`);
        } catch (error) {
          this.logger.warn(`Facility matching failed for job: ${jobId}:`, error);
        }
      }
      await job.progress(65);

      // Step 4: Process lab parameter matching directly (no sub-queue)
      let labMatches = [];
      if (extractedData.lab_reports && extractedData.lab_reports.length > 0) {
        this.logger.log(
          `Processing ${extractedData.lab_reports.length} lab parameters for job: ${jobId}`,
        );
        try {
          // Process lab parameters with concurrency control
          const concurrency = 10;
          labMatches = await this.langChainService.batchMatchLabParameters(
            extractedData.lab_reports,
            userId,
            language,
            concurrency,
          );
          this.logger.log(`Lab parameter matching completed for job: ${jobId}`);
        } catch (error) {
          this.logger.warn(`Lab parameter matching failed for job: ${jobId}:`, error);
        }
      }
      await job.progress(90);

      // Step 5: Compile final results
      const finalResults = {
        summary: documentSummary.data,
        extractedData,
        physicianMatch,
        facilityMatch,
        labMatches,
        markdownContent: documentSummary.data?.markdownContent || null,
        processingStats: {
          totalLabParameters: extractedData.lab_reports?.length || 0,
          successfulLabMatches: labMatches?.length || 0,
          hasPhysicianMatch: !!physicianMatch,
          hasFacilityMatch: !!facilityMatch,
        },
      };

      // Save complete results to file
      const fs = require('fs');
      const path = require('path');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = 'results';
      const outputFile = path.join(outputDir, `complete-processing-${timestamp}.json`);

      // Create results directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save complete processing results including all matching data
      const completeResultData = {
        timestamp: new Date().toISOString(),
        filePath,
        fileName,
        language,
        userId,
        jobId,
        extractedData,
        physicianMatch,
        facilityMatch,
        labMatches,
        processingStats: finalResults.processingStats,
        processingTime: Date.now() - startTime,
      };

      fs.writeFileSync(outputFile, JSON.stringify(completeResultData, null, 2));
      this.logger.log(`📁 Complete results saved to: ${outputFile}`);

      await job.progress(100);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Complete document processing finished for job: ${jobId} in ${processingTime}ms`,
      );

      // Generate structured webhook payload
      const structuredWebhookData = await this.documentService.generateWebhookPayload(jobId, finalResults);
      
      // Fire success webhook with structured data
      const successPayload: WebhookPayload = {
        jobId,
        status: 'success',
        userId,
        fileName,
        timestamp: new Date().toISOString(),
        data: structuredWebhookData,
      };

      // Fire webhooks asynchronously (don't wait for completion)
      this.webhookService.fireWebhooks(successPayload).catch(error => {
        this.logger.error(`Failed to fire success webhooks for job ${jobId}:`, error);
      });

      return {
        success: true,
        data: finalResults,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Document processing failed for job: ${jobId}:`, error);

      // Fire failure webhook
      const failurePayload: WebhookPayload = {
        jobId,
        status: 'failure',
        userId,
        fileName,
        timestamp: new Date().toISOString(),
        error: error.message,
      };

      // Fire webhooks asynchronously (don't wait for completion)
      this.webhookService.fireWebhooks(failurePayload).catch(webhookError => {
        this.logger.error(`Failed to fire failure webhooks for job ${jobId}:`, webhookError);
      });

      // Send Discord notification for failure
      this.discordNotificationService.notifyFailure(failurePayload)

      return {
        success: false,
        error: error.message,
        processingTime,
      };
    }
  }

  private async waitForLangChainInitialization(): Promise<void> {
    const maxWaitTime = 5 * 60 * 1000; // 5 minutes max wait
    const checkInterval = 1000; // Check every 1 second
    const startTime = Date.now();

    this.logger.log('Waiting for LangChain service initialization...');

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Check if the service is initialized by calling getHealthStatus
        const healthStatus = this.langChainService.getHealthStatus();

        if (healthStatus.initialized) {
          this.logger.log('✅ LangChain service is initialized and ready');
          return;
        }
      } catch (error) {
        // Service not ready yet, continue waiting
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // If we reach here, initialization timed out
    throw new Error('LangChain service initialization timed out after 5 minutes');
  }
}
