import * as dotenv from 'dotenv';
import { createLLMService } from './services/llmService';
import { DocumentSummaryRequest, LabMatchingRequest } from './utils/types';

// Load environment variables
dotenv.config();

// Export main classes and functions for external use
export { createLLMService } from './services/llmService';
export { createVectorService } from './services/vectorService';
export { createLlamaParseService } from './models/llamaParseReader';
export { createLLMModelsService } from './models/llmModels';
export * from './utils/types';
export * from './utils/prompts';

/**
 * Main function to demonstrate the lab matching system
 */
async function main() {
  console.log('🧪 LangChain.js Lab Parameter Matching System\n');

  // Check for required environment variables
  const requiredEnvVars = ['OPENAI_API_KEY', 'ANTHROPIC_KEY', 'LLAMAINDEX_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.log('\nPlease create a .env file with the required API keys.');
    return;
  }

  try {
    // Initialize the LLM service
    console.log('1. Initializing LLM Service...');
    const llmService = createLLMService(
      process.env.OPENAI_API_KEY!,
      process.env.ANTHROPIC_KEY!,
      process.env.LLAMAINDEX_API_KEY!
    );

    const initResult = await llmService.initialize();
    if (!initResult.success) {
      console.error('❌ Failed to initialize LLM Service:', (initResult as any).error || 'Unknown error');
      return;
    }
    console.log('✅ LLM Service initialized successfully\n');

    // Example 1: Lab parameter matching
    console.log('2. Testing Lab Parameter Matching...');
    const sampleLabReports = [
      { name: 'Hemoglobin (Hb)', result: '12.5', units: 'g/dL' },
      { name: 'Blood Glucose', result: '95', units: 'mg/dL' },
      { name: 'Total Cholesterol', result: '180', units: 'mg/dL' },
      { name: 'WBC Count', result: '7500', units: 'cells/μL' },
      { name: 'Creatinine', result: '1.0', units: 'mg/dL' }
    ];

    for (const labReport of sampleLabReports) {
      console.log(`\n   🔍 Matching: ${labReport.name}`);
      
      const matchingRequest: LabMatchingRequest = {
        labReportInfo: labReport,
        userId: 'demo-user',
        language: 'en'
      };

      const result = await llmService.matchLabReportsInfo(matchingRequest);
      
      if (result.status) {
        console.log(`   ✅ Match found for ${labReport.name}`);
        if (result.data) {
          console.log(`   📊 Matched Parameter: ${result.data.matched_parameter || 'N/A'}`);
          console.log(`   🎯 Match Score: ${result.data.match_info?.match_score || 'N/A'}`);
        }
      } else {
        console.log(`   ❌ Matching failed: ${result.message}`);
      }
    }

    // Example 2: Document processing (if file path provided)
    const testFilePath = process.env.TEST_FILE_PATH;
    if (testFilePath) {
      console.log('\n3. Testing Document Processing...');
      console.log(`   📄 Processing file: ${testFilePath}`);
      
      const summaryRequest: DocumentSummaryRequest = {
        filePath: testFilePath,
        userId: 'demo-user',
        language: 'en'
      };

      const summaryResult = await llmService.getDocumentSummary(summaryRequest);
      
      if (summaryResult.status) {
        console.log('   ✅ Document processed successfully');
        if (summaryResult.data && summaryResult.data.lab_reports) {
          console.log(`   📋 Found ${summaryResult.data.lab_reports.length} lab parameters`);
        }
      } else {
        console.log(`   ❌ Document processing failed: ${summaryResult.message}`);
      }
    } else {
      console.log('\n3. Skipping document processing (set TEST_FILE_PATH environment variable to test)');
    }

    console.log('\n🎉 Demo completed successfully!');
    console.log('\n📚 Usage:');
    console.log('   - Set up your API keys in .env file');
    console.log('   - Use createLLMService() to initialize the service');
    console.log('   - Call matchLabReportsInfo() for lab parameter matching');
    console.log('   - Call getDocumentSummary() for document processing');

  } catch (error) {
    console.error('❌ Demo failed with error:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  main();
}
