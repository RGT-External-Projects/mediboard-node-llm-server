import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MedicalProcessor } from './processors/medical.processor';
import { ProcessingService } from './services/processing.service';
import { QUEUE_NAMES } from '../../types';
import { LangChainModule } from '../langchain/langchain.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [
    // Register single queue for all medical processing with extended timeouts
    BullModule.registerQueue({
      name: QUEUE_NAMES.MEDICAL_PROCESSING,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        // 10 minute timeout for all processing jobs
        timeout: 10 * 60 * 1000, // 600,000ms = 10 minutes
      },
    }),
    
    // Import LangChain services
    LangChainModule,
    
    // Import Webhook services
    WebhookModule,
  ],
  providers: [
    ProcessingService,
    MedicalProcessor,
  ],
  exports: [ProcessingService],
})
export class ProcessingModule {}
