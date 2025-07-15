import { LlamaParseReader } from 'llamaindex';
import * as fs from 'fs';
import { LlamaParseConfig, ApiResponse } from '../utils/types';
import pLimit from 'p-limit';

export class LlamaParseService {
  private reader: LlamaParseReader;

  constructor(apiKey: string) {
    this.reader = new LlamaParseReader({
      apiKey,
      resultType: 'markdown',
      parse_mode: 'parse_document_with_agent',
      model: 'anthropic-sonnet-4.0',
    } as any);
  }

  /**
   * Parse document and return markdown results
   * Supports both local files and remote URLs
   */
  async parseDocument(filePath: string): Promise<ApiResponse<string>> {
    try {
      console.log(`Parsing document: ${filePath}`);

      // Check if it's a local file
      if (!filePath.startsWith('http') && !fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      // Use LlamaParseReader to load and parse documents
      const documents = await this.reader.loadData(filePath);
      
      if (!documents || documents.length === 0) {
        return {
          success: false,
          error: 'No documents were parsed from the file'
        };
      }

      // Extract markdown content from documents
      const markdown = documents
        .map((doc: any) => doc.text || doc.content || '')
        .join('\n\n');

      if (!markdown.trim()) {
        return {
          success: false,
          error: 'No content extracted from the document'
        };
      }

      console.log(`Document parsed successfully. Content length: ${markdown.length} characters`);

      return {
        success: true,
        data: markdown
      };

    } catch (error) {
      console.error('Error parsing document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// Factory function for easy instantiation
export function createLlamaParseService(apiKey: string): LlamaParseService {
  return new LlamaParseService(apiKey);
}
