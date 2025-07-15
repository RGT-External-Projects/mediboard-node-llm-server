import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ModelType, ModelConfig, ApiResponse } from '../utils/types';

export class LLMModelsService {
  private openaiApiKey: string;
  private anthropicApiKey: string;

  constructor(openaiApiKey: string, anthropicApiKey: string) {
    this.openaiApiKey = openaiApiKey;
    this.anthropicApiKey = anthropicApiKey;
  }

  /**
   * Get a configured LLM model
   */
  getModel(config: ModelConfig): ApiResponse<ChatOpenAI | ChatAnthropic> {
    try {
      console.log(`Creating ${config.type} model: ${config.modelName}`);

      switch (config.type) {
        case ModelType.OPENAI:
          const openaiModel = new ChatOpenAI({
            modelName: config.modelName,
            openAIApiKey: config.apiKey || this.openaiApiKey,
            temperature: config.temperature || 0.1,
            maxTokens: config.maxTokens || 4096,
          });

          return {
            success: true,
            data: openaiModel,
          };

        case ModelType.CLAUDE:
          const claudeModel = new ChatAnthropic({
            modelName: config.modelName,
            anthropicApiKey: config.apiKey || this.anthropicApiKey,
            temperature: config.temperature || 0.1,
            maxTokens: config.maxTokens || 4096,
          });

          return {
            success: true,
            data: claudeModel,
          };

        default:
          return {
            success: false,
            error: `Unsupported model type: ${config.type}`,
          };
      }
    } catch (error) {
      console.error('Error creating model:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Test model connectivity
   */
  async testModel(config: ModelConfig): Promise<ApiResponse<boolean>> {
    try {
      const modelResult = this.getModel(config);
      if (!modelResult.success) {
        return modelResult as ApiResponse<boolean>;
      }

      const model = modelResult.data;

      // Test with a simple prompt
      const response = await model.invoke('Hello, respond with "OK" if you can hear me.');

      if (response && response.content) {
        console.log(`✅ Model ${config.modelName} is working`);
        return {
          success: true,
          data: true,
        };
      } else {
        return {
          success: false,
          error: 'Model did not respond properly',
        };
      }
    } catch (error) {
      console.error(`❌ Model ${config.modelName} test failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

// Factory function for easy instantiation
export function createLLMModelsService(
  openaiApiKey: string,
  anthropicApiKey: string,
): LLMModelsService {
  return new LLMModelsService(openaiApiKey, anthropicApiKey);
}

// Helper functions for common model configurations
export function createOpenAIConfig(
  modelName: string = 'gpt-4o',
  temperature: number = 0.1,
  maxTokens: number = 16384,
): ModelConfig {
  return {
    type: ModelType.OPENAI,
    modelName,
    temperature,
    maxTokens,
  };
}

export function createClaudeConfig(
  modelName: string = 'claude-3-7-sonnet-latest',
  temperature: number = 0.1,
  maxTokens: number = 16384,
): ModelConfig {
  return {
    type: ModelType.CLAUDE,
    modelName,
    temperature,
    maxTokens,
  };
}
