import { JsonOutputParser } from '@langchain/core/output_parsers';
import { createLlamaParseService } from '../models/llamaParseReader';
import { createVectorService } from './vectorService';
import {
  createLLMModelsService,
  createOpenAIConfig,
  createClaudeConfig,
} from '../models/llmModels';
import { 
  formatLabExtractionPrompt, 
  formatLabMatchingPrompt,
  formatPhysicianMatchingPrompt,
  formatFacilityMatchingPrompt
} from '../utils/prompts';
import {
  labExtractionSchema,
  physicianMatchingSchema,
  facilityMatchingSchema,
  labReportMatchingSchema,
  getSchemaInstructions
} from '../utils/schemas';
import {
  UploadedFileContent,
  LabReportItem,
  LabReportInfo,
  DocumentSummaryRequest,
  LabMatchingRequest,
  PhysicianMatchingRequest,
  MedicalFacilityMatchingRequest,
  MatchedPhysicianInfo,
  MatchedMedicalFacilityInfo,
  ProcessingResult,
  ApiResponse,
  ModelType
} from '../utils/types';

export class LLMService {
  private llamaParseService: any;
  private vectorService: any;
  private llmModelsService: any;
  private isInitialized = false;

  constructor(
    private openaiApiKey: string,
    private anthropicApiKey: string,
    private llamaIndexApiKey: string,
  ) {
    this.llamaParseService = createLlamaParseService(llamaIndexApiKey);
    this.vectorService = createVectorService(openaiApiKey);
    this.llmModelsService = createLLMModelsService(openaiApiKey, anthropicApiKey);
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<ApiResponse<boolean>> {
    try {
      console.log('Initializing LLM Service...');

      // Initialize vector service
      const vectorResult = await this.vectorService.initialize();
      if (!vectorResult.success) {
        return vectorResult;
      }

      this.isInitialized = true;
      console.log('✅ LLM Service initialized successfully');

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error initializing LLM Service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get document summary using LlamaParseReader and LLM
   */
  async getDocumentSummary(request: DocumentSummaryRequest): Promise<ProcessingResult> {
    try {
      if (!this.isInitialized) {
        return {
          status: false,
          message: 'Service not initialized. Call initialize() first.',
          data: null,
        };
      }

      console.log(`Processing document: ${request.filePath}`);

      // Step 1: Parse document with LlamaParseReader
      const parseResult = await this.llamaParseService.parseDocument(request.filePath);
      if (!parseResult.success) {
        return {
          status: false,
          message: `Document parsing failed: ${parseResult.error}`,
          data: null,
        };
      }

      const markdownContent = parseResult.data;
      console.log(
        `Document parsed successfully. Content length: ${markdownContent.length}`,
      );

      // Step 2: Extract lab data using LLM
      const extractionResult = await this.extractLabData(
        markdownContent,
        request.language,
      );
      if (!extractionResult.status) {
        return extractionResult;
      }

      console.log('Document summary generated successfully');

      // Save results to file
      const fs = require('fs');
      const path = require('path');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = 'results';
      const outputFile = path.join(outputDir, `document-extraction-${timestamp}.json`);

      // Create results directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save extraction results
      const resultData = {
        timestamp: new Date().toISOString(),
        filePath: request.filePath,
        language: request.language,
        userId: request.userId,
        extractedData: extractionResult.data,
        markdownLength: markdownContent.length,
      };

      fs.writeFileSync(outputFile, JSON.stringify(resultData, null, 2));
      console.log(`📁 Results saved to: ${outputFile}`);

      return {
        status: true,
        message: 'Document summary successfully retrieved.',
        data: extractionResult.data,
      };
    } catch (error) {
      console.error('Error in getDocumentSummary:', error);
      return {
        status: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      };
    }
  }

  /**
   * Match physician info using vector search and LLM
   */
  async matchPhysicianInfo(request: PhysicianMatchingRequest): Promise<ProcessingResult> {
    try {
      if (!this.isInitialized) {
        return {
          status: false,
          message: 'Service not initialized. Call initialize() first.',
          data: null,
        };
      }

      console.log(`Matching physician: ${request.physicianInfo.first_name} ${request.physicianInfo.last_name}`);

      // Check if physician info is empty
      if (!request.physicianInfo.first_name && !request.physicianInfo.last_name) {
        return {
          status: true,
          message: 'No physician data found in document',
          data: {
            matched_id: null,
            matched_title: null,
            matched_name: null,
            matched_lastname: null,
            match_info: {
              match_score: 'Unknown',
              reason: 'Physician data is not found in uploaded document',
            },
          },
        };
      }

      // Step 1: Vector similarity search for physicians
      const searchQuery = `${request.physicianInfo.first_name || ''} ${request.physicianInfo.last_name || ''}`.trim();
      const searchResult = await this.vectorService.searchSimilarDoctors(searchQuery, 10);

      if (!searchResult.success) {
        return {
          status: false,
          message: `Physician vector search failed: ${searchResult.error}`,
          data: null,
        };
      }

      // Step 2: Use LLM to match and analyze
      const matchingResult = await this.performPhysicianMatching(
        request.physicianInfo,
        searchResult.data,
        request.language,
      );

      if (!matchingResult.status) {
        return matchingResult;
      }

      console.log('Physician matching completed successfully');
      return {
        status: true,
        message: 'Physician info matched successfully',
        data: matchingResult.data,
      };
    } catch (error) {
      console.error('Error in matchPhysicianInfo:', error);
      return {
        status: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      };
    }
  }

  /**
   * Match medical facility info using vector search and LLM
   */
  async matchMedicalFacilityInfo(request: MedicalFacilityMatchingRequest): Promise<ProcessingResult> {
    try {
      if (!this.isInitialized) {
        return {
          status: false,
          message: 'Service not initialized. Call initialize() first.',
          data: null,
        };
      }

      console.log(`Matching medical facility: ${request.facilityInfo.facility_name}`);

      if (!request.facilityInfo.facility_name) {
        return {
          status: true,
          message: 'No facility data found in document',
          data: {
            value_name: null,
            matched_display_name: null,
            matched_id: null,
            match_info: {
              match_score: 'Unknown',
              reason: 'Facility data is not found in uploaded document',
            },
          },
        };
      }

      // Step 1: Vector similarity search for medical facilities
      const searchQuery = request.facilityInfo.facility_name.trim();
      const searchResult = await this.vectorService.searchSimilarInstitutes(searchQuery, 10);

      if (!searchResult.success) {
        return {
          status: false,
          message: `Facility vector search failed: ${searchResult.error}`,
          data: null,
        };
      }

      // Step 2: Use LLM to match and analyze
      const matchingResult = await this.performFacilityMatching(
        request.facilityInfo,
        searchResult.data,
        request.language,
      );

      if (!matchingResult.status) {
        return matchingResult;
      }

      console.log('Medical facility matching completed successfully');
      return {
        status: true,
        message: 'Institution info matched successfully',
        data: matchingResult.data,
      };
    } catch (error) {
      console.error('Error in matchMedicalFacilityInfo:', error);
      return {
        status: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      };
    }
  }

  /**
   * Match lab reports info using vector search and LLM
   */
  async matchLabReportsInfo(request: LabMatchingRequest): Promise<ProcessingResult> {
    try {
      if (!this.isInitialized) {
        return {
          status: false,
          message: 'Service not initialized. Call initialize() first.',
          data: null,
        };
      }

      console.log(`Matching lab report: ${request.labReportInfo.name}`);

      // Step 1: Vector similarity search
      const searchQuery = `${request.labReportInfo.name}`.trim();
      const searchResult = await this.vectorService.searchSimilar(searchQuery, 10);

      if (!searchResult.success) {
        return {
          status: false,
          message: `Vector search failed: ${searchResult.error}`,
          data: null,
        };
      }

      // Step 2: Use LLM to match and analyze
      const matchingResult = await this.performLabMatching(
        request.labReportInfo,
        searchResult.data,
        request.language,
      );

      if (!matchingResult.status) {
        return matchingResult;
      }

      console.log('Lab report matching completed successfully');
      return {
        status: true,
        message: 'Lab report matched successfully',
        data: matchingResult.data,
      };
    } catch (error) {
      console.error('Error in matchLabReportsInfo:', error);
      return {
        status: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      };
    }
  }

  /**
   * Extract lab data from markdown content using LLM with structured schema
   */
  private async extractLabData(
    markdownContent: string,
    language: string,
  ): Promise<ProcessingResult> {
    try {
      // Get Claude model for better structured output
      const modelConfig = createClaudeConfig();
      const modelResult = this.llmModelsService.getModel(modelConfig);

      if (!modelResult.success) {
        return {
          status: false,
          message: `Failed to create model: ${modelResult.error}`,
          data: null,
        };
      }

      const model = modelResult.data;

      // Setup JSON output parser with structured schema
      const parser = new JsonOutputParser();

      // Use the structured schema instructions instead of generic format
      const schemaInstructions = getSchemaInstructions(labExtractionSchema);

      // Create formatted prompt with schema-specific instructions
      const promptText = formatLabExtractionPrompt(
        markdownContent,
        language,
        schemaInstructions,
      );

      // Create chain and execute
      const chain = model.pipe(parser);
      const result = await chain.invoke(promptText);

      // Validate the result against the schema
      if (!this.validateLabExtractionResult(result)) {
        console.warn('Lab extraction result does not match expected schema');
      }

      return {
        status: true,
        message: 'Lab data extracted successfully using structured schema',
        data: result,
      };
    } catch (error) {
      console.error('Error extracting lab data:', error);
      return {
        status: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      };
    }
  }

  /**
   * Validate lab extraction result against schema
   */
  private validateLabExtractionResult(result: any): boolean {
    try {
      // Check if result has required fields from labExtractionSchema
      if (!result || typeof result !== 'object') {
        return false;
      }

      // Check for required lab_reports array
      if (!Array.isArray(result.lab_reports)) {
        console.warn('Missing or invalid lab_reports array');
        return false;
      }

      // Validate each lab report item
      for (const report of result.lab_reports) {
        if (!report.name) {
          console.warn('Lab report missing required name field');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error validating lab extraction result:', error);
      return false;
    }
  }

  /**
   * Perform lab matching using LLM and vector search results with structured schema
   */
  private async performLabMatching(
    labReportInfo: LabReportInfo,
    vectorResults: any[],
    language: string,
  ): Promise<ProcessingResult> {
    try {
      // Get OpenAI model
      const modelConfig = createOpenAIConfig('gpt-4o-mini', 0.1, 16384);
      const modelResult = this.llmModelsService.getModel(modelConfig);

      if (!modelResult.success) {
        return {
          status: false,
          message: `Failed to create model: ${modelResult.error}`,
          data: null,
        };
      }

      const model = modelResult.data;

      // Setup JSON output parser with structured schema
      const parser = new JsonOutputParser();

      // Prepare context from vector search results
      const context = vectorResults
        .map(
          (result) =>
            `ID: ${result.metadata.id}, Parameter: ${result.metadata.parameter}`,
        )
        .join('\n');

      // Create prompt
      const question = `Which lab parameter is related to the lab test parameter ${labReportInfo.name} using the context data?`;

      // Use structured schema instructions
      const schemaInstructions = getSchemaInstructions(labReportMatchingSchema);

      const promptText = formatLabMatchingPrompt(
        context,
        JSON.stringify(labReportInfo),
        language,
        question,
        schemaInstructions,
      );

      // Create chain and execute
      const chain = model.pipe(parser);
      const result = await chain.invoke(promptText);

      // Add test_params to result
      const finalResult = {
        ...result,
        test_params: labReportInfo,
      };

      return {
        status: true,
        message: 'Lab matching completed successfully using structured schema',
        data: finalResult,
      };
    } catch (error) {
      console.error('Error performing lab matching:', error);
      return {
        status: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      };
    }
  }

  /**
   * Perform physician matching using LLM and vector search results with structured schema
   */
  private async performPhysicianMatching(
    physicianInfo: any,
    vectorResults: any[],
    language: string,
  ): Promise<ProcessingResult> {
    try {
      // Get OpenAI model
      const modelConfig = createOpenAIConfig('gpt-4o-mini', 0.1, 16384);
      const modelResult = this.llmModelsService.getModel(modelConfig);

      if (!modelResult.success) {
        return {
          status: false,
          message: `Failed to create model: ${modelResult.error}`,
          data: null,
        };
      }

      const model = modelResult.data;

      // Setup JSON output parser with structured schema
      const parser = new JsonOutputParser();

      // Prepare context from vector search results
      const context = vectorResults
        .map(
          (result) =>
            `ID: ${result.metadata.id}, Name: ${result.metadata.doctorName}, LastName: ${result.metadata.doctorLastName}`,
        )
        .join('\n');

      // Create prompt
      const question = `Which physician can be mapped with ${physicianInfo.first_name} ${physicianInfo.last_name}?`;

      // Use structured schema instructions
      const schemaInstructions = getSchemaInstructions(physicianMatchingSchema);

      const promptText = formatPhysicianMatchingPrompt(
        context,
        JSON.stringify(physicianInfo),
        language,
        question,
        schemaInstructions,
      );

      // Create chain and execute
      const chain = model.pipe(parser);
      const result = await chain.invoke(promptText);

      return {
        status: true,
        message: 'Physician matching completed successfully using structured schema',
        data: result,
      };
    } catch (error) {
      console.error('Error performing physician matching:', error);
      return {
        status: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      };
    }
  }

  /**
   * Perform facility matching using LLM and vector search results with structured schema
   */
  private async performFacilityMatching(
    facilityInfo: any,
    vectorResults: any[],
    language: string,
  ): Promise<ProcessingResult> {
    try {
      // Get OpenAI model
      const modelConfig = createOpenAIConfig('gpt-4o-mini', 0.1, 16384);
      const modelResult = this.llmModelsService.getModel(modelConfig);

      if (!modelResult.success) {
        return {
          status: false,
          message: `Failed to create model: ${modelResult.error}`,
          data: null,
        };
      }

      const model = modelResult.data;

      // Setup JSON output parser with structured schema
      const parser = new JsonOutputParser();

      // Prepare context from vector search results
      const context = vectorResults
        .map(
          (result) =>
            `ID: ${result.metadata.id}, Value: ${result.metadata.value}, DisplayName: ${result.metadata.displayName}`,
        )
        .join('\n');

      // Create prompt
      const question = `Which institution can be mapped with ${facilityInfo.facility_name}?`;

      // Use structured schema instructions
      const schemaInstructions = getSchemaInstructions(facilityMatchingSchema);

      const promptText = formatFacilityMatchingPrompt(
        context,
        JSON.stringify(facilityInfo),
        language,
        question,
        schemaInstructions,
      );

      // Create chain and execute
      const chain = model.pipe(parser);
      const result = await chain.invoke(promptText);

      return {
        status: true,
        message: 'Facility matching completed successfully using structured schema',
        data: result,
      };
    } catch (error) {
      console.error('Error performing facility matching:', error);
      return {
        status: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      };
    }
  }
}

// Factory function for easy instantiation
export function createLLMService(
  openaiApiKey: string,
  anthropicApiKey: string,
  llamaIndexApiKey: string,
): LLMService {
  return new LLMService(openaiApiKey, anthropicApiKey, llamaIndexApiKey);
}
