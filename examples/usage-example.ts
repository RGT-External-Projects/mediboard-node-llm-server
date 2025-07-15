import * as fs from 'fs';
import * as path from 'path';

/**
 * Medical Processing Service Usage Example
 * 
 * This example demonstrates how to use the Medical Processing Service
 * to upload and process medical documents with background job queues.
 */

const API_BASE_URL = 'http://localhost:3000/api/v1';

interface ProcessingStatus {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: {
    documentSummary: boolean;
    physicianMatching: boolean;
    facilityMatching: boolean;
    labParameterMatching: {
      total: number;
      completed: number;
      percentage: number;
    };
  };
  results?: {
    summary?: any;
    physicianMatch?: any;
    facilityMatch?: any;
    labMatches?: any[];
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

class MedicalProcessingClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Upload and process a medical document
   */
  async processDocument(filePath: string, userId: string, language: string = 'en'): Promise<{ jobId: string; status: string }> {
    try {
      console.log(`📄 Uploading document: ${path.basename(filePath)}`);

      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);

      // Create form data
      const formData = new FormData();
      const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('file', fileBlob, fileName);
      formData.append('userId', userId);
      formData.append('language', language);

      // Upload file
      const response = await fetch(`${this.baseUrl}/documents/process`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Document uploaded successfully. Job ID: ${result.data.jobId}`);
      
      return result.data;
    } catch (error) {
      console.error('❌ Failed to upload document:', error);
      throw error;
    }
  }

  /**
   * Get processing status for a job
   */
  async getStatus(jobId: string): Promise<ProcessingStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/status/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error(`❌ Failed to get status for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get final results for a completed job
   */
  async getResults(jobId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/results/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get results: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error(`❌ Failed to get results for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Poll for job completion with progress updates
   */
  async waitForCompletion(jobId: string, pollInterval: number = 2000): Promise<ProcessingStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getStatus(jobId);
          
          // Log progress
          this.logProgress(status);

          if (status.status === 'completed') {
            console.log('🎉 Processing completed successfully!');
            resolve(status);
          } else if (status.status === 'failed') {
            console.error('❌ Processing failed:', status.error);
            reject(new Error(status.error));
          } else {
            // Continue polling
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Log processing progress
   */
  private logProgress(status: ProcessingStatus) {
    console.log(`\n📊 Job Status: ${status.status.toUpperCase()}`);
    console.log('Progress:');
    console.log(`  📋 Document Summary: ${status.progress.documentSummary ? '✅' : '⏳'}`);
    console.log(`  👨‍⚕️ Physician Matching: ${status.progress.physicianMatching ? '✅' : '⏳'}`);
    console.log(`  🏥 Facility Matching: ${status.progress.facilityMatching ? '✅' : '⏳'}`);
    console.log(`  🧪 Lab Parameter Matching: ${status.progress.labParameterMatching.completed}/${status.progress.labParameterMatching.total} (${status.progress.labParameterMatching.percentage}%)`);
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  }

  /**
   * Get processing metrics
   */
  async getMetrics(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/metrics`);
      
      if (!response.ok) {
        throw new Error(`Failed to get metrics: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('❌ Failed to get metrics:', error);
      throw error;
    }
  }

  /**
   * List all jobs with optional filtering
   */
  async listJobs(options: {
    status?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (options.status) params.append('status', options.status);
      if (options.userId) params.append('userId', options.userId);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());

      const response = await fetch(`${this.baseUrl}/documents/jobs?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to list jobs: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('❌ Failed to list jobs:', error);
      throw error;
    }
  }

  /**
   * Cancel a processing job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/jobs/${jobId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel job: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Job ${jobId} cancelled successfully`);
      return result.success;
    } catch (error) {
      console.error(`❌ Failed to cancel job ${jobId}:`, error);
      throw error;
    }
  }
}

/**
 * Example usage function
 */
async function runExample() {
  console.log('🚀 Medical Processing Service - Usage Example\n');

  const client = new MedicalProcessingClient();

  try {
    // 1. Check service health
    console.log('1. Checking service health...');
    const health = await client.getHealth();
    console.log(`✅ Service status: ${health.status}`);
    console.log(`📊 Queue stats:`, health.queues);

    // 2. Get current metrics
    console.log('\n2. Getting current metrics...');
    const metrics = await client.getMetrics();
    console.log(`📈 Total jobs: ${metrics.totalJobs}`);
    console.log(`✅ Completed: ${metrics.completedJobs}`);
    console.log(`❌ Failed: ${metrics.failedJobs}`);
    console.log(`⏱️ Average processing time: ${metrics.averageProcessingTime}ms`);

    // 3. Process a document (example with a sample file)
    console.log('\n3. Processing a medical document...');
    
    // Note: Replace with actual file path
    const sampleFilePath = '../data_images/20130717_mayo_clinic.pdf';
    
    if (fs.existsSync(sampleFilePath)) {
      const { jobId } = await client.processDocument(
        sampleFilePath,
        'example-user-123',
        'en'
      );

      // 4. Wait for completion with progress updates
      console.log('\n4. Waiting for processing to complete...');
      const finalStatus = await client.waitForCompletion(jobId);

      // 5. Get final results
      console.log('\n5. Getting final results...');
      const results = await client.getResults(jobId);
      
      console.log('\n📋 Final Results:');
      console.log('Document Summary:', results.summary ? '✅ Available' : '❌ Not available');
      console.log('Physician Match:', results.physicianMatch ? '✅ Available' : '❌ Not available');
      console.log('Facility Match:', results.facilityMatch ? '✅ Available' : '❌ Not available');
      console.log('Lab Matches:', results.labMatches ? `✅ ${results.labMatches.length} matches` : '❌ Not available');

      // Display sample results
      if (results.physicianMatch) {
        console.log('\n👨‍⚕️ Physician Match Sample:');
        console.log(JSON.stringify(results.physicianMatch, null, 2));
      }

      if (results.facilityMatch) {
        console.log('\n🏥 Facility Match Sample:');
        console.log(JSON.stringify(results.facilityMatch, null, 2));
      }

      if (results.labMatches && results.labMatches.length > 0) {
        console.log('\n🧪 Lab Parameter Matches Sample (first 3):');
        console.log(JSON.stringify(results.labMatches.slice(0, 3), null, 2));
      }

    } else {
      console.log(`⚠️ Sample file not found: ${sampleFilePath}`);
      console.log('Please provide a valid medical document file path.');
    }

    // 6. List recent jobs
    console.log('\n6. Listing recent jobs...');
    const recentJobs = await client.listJobs({ limit: 5 });
    console.log(`📋 Found ${recentJobs.jobs.length} recent jobs (total: ${recentJobs.total})`);
    
    recentJobs.jobs.forEach((job: ProcessingStatus, index: number) => {
      console.log(`  ${index + 1}. Job ${job.jobId}: ${job.status} (${job.createdAt})`);
    });

  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

/**
 * Batch processing example
 */
async function runBatchExample() {
  console.log('\n🔄 Batch Processing Example\n');

  const client = new MedicalProcessingClient();
  const sampleFiles = [
    '../data_images/20130717_mayo_clinic.pdf',
    '../data_images/20150104_maccabi.pdf',
    '../data_images/20230608_maccabi.pdf',
  ];

  const jobIds: string[] = [];

  try {
    // Upload multiple documents
    console.log('📤 Uploading multiple documents...');
    for (const filePath of sampleFiles) {
      if (fs.existsSync(filePath)) {
        const { jobId } = await client.processDocument(
          filePath,
          'batch-user-456',
          'en'
        );
        jobIds.push(jobId);
        console.log(`✅ Uploaded: ${path.basename(filePath)} (Job: ${jobId})`);
      }
    }

    // Monitor all jobs
    console.log('\n📊 Monitoring batch processing...');
    const completedJobs: ProcessingStatus[] = [];

    while (completedJobs.length < jobIds.length) {
      for (const jobId of jobIds) {
        if (!completedJobs.find(job => job.jobId === jobId)) {
          const status = await client.getStatus(jobId);
          
          if (status.status === 'completed' || status.status === 'failed') {
            completedJobs.push(status);
            console.log(`${status.status === 'completed' ? '✅' : '❌'} Job ${jobId}: ${status.status}`);
          }
        }
      }

      if (completedJobs.length < jobIds.length) {
        console.log(`⏳ Waiting for ${jobIds.length - completedJobs.length} jobs to complete...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n🎉 Batch processing completed!');
    console.log(`✅ Successful: ${completedJobs.filter(job => job.status === 'completed').length}`);
    console.log(`❌ Failed: ${completedJobs.filter(job => job.status === 'failed').length}`);

  } catch (error) {
    console.error('❌ Batch processing failed:', error);
  }
}

// Run examples
if (require.main === module) {
  console.log('🧪 Medical Processing Service Examples\n');
  console.log('Make sure the service is running at http://localhost:3000\n');

  runExample()
    .then(() => {
      console.log('\n' + '='.repeat(50));
      return runBatchExample();
    })
    .then(() => {
      console.log('\n✨ All examples completed!');
    })
    .catch((error) => {
      console.error('❌ Examples failed:', error);
      process.exit(1);
    });
}

export { MedicalProcessingClient };
