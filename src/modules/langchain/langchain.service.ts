import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import pLimit from '../../utils/p-limit';

// Import our existing LangChain services
// Note: These imports will be resolved once we copy the langchainjs services
interface LLMService {
  initialize(): Promise<any>;
  getDocumentSummary(request: any): Promise<any>;
  matchPhysicianInfo(request: any): Promise<any>;
  matchMedicalFacilityInfo(request: any): Promise<any>;
  matchLabReportsInfo(request: any): Promise<any>;
  updateLabParameters(newParameters: Array<{id: number, parameter: string}>): Promise<any>;
  updateDoctors(newDoctors: Array<{id: number, doctorName: string, doctorLastName: string}>): Promise<any>;
  updateInstitutes(newInstitutes: Array<{id: number, value: string, displayName?: string}>): Promise<any>;
}

@Injectable()
export class LangChainService implements OnModuleInit {
  private readonly logger = new Logger(LangChainService.name);
  private llmService: LLMService;
  private isInitialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      this.logger.log('Initializing LangChain services...');

      // Dynamic import of our existing LangChain services
      const { createLLMService } = await import('../../../langchainjs');

      this.llmService = createLLMService(
        this.configService.get('OPENAI_API_KEY'),
        this.configService.get('ANTHROPIC_KEY'),
        this.configService.get('LLAMAINDEX_API_KEY'),
      );

      const initResult = await this.llmService.initialize();
      if (!initResult.success) {
        throw new Error(`LLM Service initialization failed: ${initResult.error}`);
      }

      this.isInitialized = true;
      this.logger.log('✅ LangChain services initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize LangChain services:', error);
      throw error;
    }
  }

  private ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('LangChain service not initialized');
    }
  }

  async getDocumentSummary(request: {
    filePath: string;
    userId: string;
    language: string;
  }) {
    this.ensureInitialized();
    this.logger.log(`Processing document summary for: ${request.filePath}`);

    try {
      const result = await this.llmService.getDocumentSummary(request);
      this.logger.log('Document summary completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Document summary failed:', error);
      throw error;
    }
  }

  async matchPhysician(request: {
    physicianInfo: {
      first_name?: string;
      last_name?: string;
      title?: string;
    };
    userId: string;
    language: string;
  }) {
    this.ensureInitialized();
    this.logger.log(
      `Matching physician: ${request.physicianInfo.first_name} ${request.physicianInfo.last_name}`,
    );

    try {
      const result = await this.llmService.matchPhysicianInfo(request);
      this.logger.log('Physician matching completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Physician matching failed:', error);
      throw error;
    }
  }

  async matchFacility(request: {
    facilityInfo: {
      facility_name: string;
      address?: string;
    };
    userId: string;
    language: string;
  }) {
    this.ensureInitialized();
    this.logger.log(`Matching facility: ${request.facilityInfo.facility_name}`);

    try {
      const result = await this.llmService.matchMedicalFacilityInfo(request);
      this.logger.log('Facility matching completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Facility matching failed:', error);
      throw error;
    }
  }

  async matchLabParameter(request: {
    labReportInfo: {
      name: string;
      result?: string;
      units?: string;
      range?: string;
      comment?: string;
    };
    userId: string;
    language: string;
  }) {
    this.ensureInitialized();
    this.logger.log(`Matching lab parameter: ${request.labReportInfo.name}`);

    try {
      const result = await this.llmService.matchLabReportsInfo(request);
      this.logger.log('Lab parameter matching completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Lab parameter matching failed:', error);
      throw error;
    }
  }

  async batchMatchLabParameters(
    parameters: Array<{
      name: string;
      result?: string;
      units?: string;
      range?: string;
      comment?: string;
    }>,
    userId: string,
    language: string,
    concurrency: number = 10,
  ) {
    this.ensureInitialized();
    this.logger.log(
      `Batch matching ${parameters.length} lab parameters with concurrency: ${concurrency}`,
    );

    try {
      // Use our custom p-limit implementation for concurrency control
      const limit = pLimit(concurrency);

      const promises = parameters.map((parameter) =>
        limit(async () => {
          return await this.matchLabParameter({
            labReportInfo: parameter,
            userId,
            language,
          });
        }),
      );

      const results = await Promise.all(promises);
      this.logger.log(
        `Batch lab parameter matching completed: ${results.length} results`,
      );
      return results;
    } catch (error) {
      this.logger.error('Batch lab parameter matching failed:', error);
      throw error;
    }
  }

  async updateLabParameters(newParameters: Array<{id: number, parameter: string}>) {
    this.ensureInitialized();
    this.logger.log(`Updating lab parameters vector store with ${newParameters.length} entries`);

    try {
      const result = await this.llmService.updateLabParameters(newParameters);
      this.logger.log('Lab parameters updated successfully');
      return result;
    } catch (error) {
      this.logger.error('Lab parameters update failed:', error);
      throw error;
    }
  }

  async updateDoctors(newDoctors: Array<{id: number, doctorName: string, doctorLastName: string}>) {
    this.ensureInitialized();
    this.logger.log(`Updating doctors vector store with ${newDoctors.length} entries`);

    try {
      const result = await this.llmService.updateDoctors(newDoctors);
      this.logger.log('Doctors updated successfully');
      return result;
    } catch (error) {
      this.logger.error('Doctors update failed:', error);
      throw error;
    }
  }

  async updateInstitutes(newInstitutes: Array<{id: number, value: string, displayName?: string}>) {
    this.ensureInitialized();
    this.logger.log(`Updating institutes vector store with ${newInstitutes.length} entries`);

    try {
      const result = await this.llmService.updateInstitutes(newInstitutes);
      this.logger.log('Institutes updated successfully');
      return result;
    } catch (error) {
      this.logger.error('Institutes update failed:', error);
      throw error;
    }
  }

  getHealthStatus() {
    return {
      initialized: this.isInitialized,
      service: 'LangChain Service',
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }
}
