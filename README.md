# Medical Processing Service

A NestJS background service for medical document processing with BullMQ job queues, featuring sequential physician and facility matching, and parallel lab parameter matching with concurrency control.

## 🚀 Features

- **Document Processing Pipeline**: Upload → Summary → Extraction → Sequential & Parallel Processing
- **Sequential Processing**: Physician Matching → Medical Facility Matching
- **Parallel Processing**: Lab Parameter Matching with configurable concurrency (default: 10)
- **Job Queue Management**: BullMQ with Redis for reliable background processing
- **Real-time Monitoring**: Job status tracking, progress updates, and metrics
- **LangChain Integration**: Leverages existing LangChain services for AI-powered matching
- **RESTful API**: Complete API with Swagger documentation
- **Health Checks**: Comprehensive health monitoring for all services and queues

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   File Upload   │───▶│ Document Summary │───▶│ Data Extraction │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌─────────────────────────────────┼─────────────────────────────────┐
                       │                                 ▼                                 │
                       │                    ┌─────────────────────┐                       │
                       │                    │ Sequential Pipeline │                       │
                       │                    └─────────────────────┘                       │
                       │                              │                                   │
                       │                              ▼                                   │
                       │                    ┌─────────────────────┐                       │
                       │                    │ Physician Matching  │                       │
                       │                    └─────────────────────┘                       │
                       │                              │                                   │
                       │                              ▼                                   │
                       │                    ┌─────────────────────┐                       │
                       │                    │ Facility Matching   │                       │
                       │                    └─────────────────────┘                       │
                       │                                                                  │
                       │                    ┌─────────────────────┐                       │
                       └───────────────────▶│ Parallel Pipeline   │◀──────────────────────┘
                                            └─────────────────────┘
                                                      │
                                                      ▼
                                            ┌─────────────────────┐
                                            │ Lab Parameter       │
                                            │ Matching            │
                                            │ (Concurrency: 10)   │
                                            └─────────────────────┘
```

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Configure your API keys in .env
```

## ⚙️ Configuration

Update `.env` with your API keys and settings:

```env
# Application
NODE_ENV=development
PORT=3000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_KEY=your_anthropic_api_key_here
LLAMAINDEX_API_KEY=your_llamaindex_api_key_here

# Job Queue Configuration
QUEUE_CONCURRENCY=10
MAX_RETRY_ATTEMPTS=3
JOB_TIMEOUT=300000
```

## 🚀 Running the Service

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The service will be available at:
- **API**: http://localhost:3000/api/v1
- **Documentation**: http://localhost:3000/api/docs

## 📋 API Endpoints

### Document Processing

```bash
# Upload and process a medical document
POST /api/v1/documents/process
Content-Type: multipart/form-data
Body: { file: <file>, userId: "user123", language: "en" }

# Get processing status
GET /api/v1/documents/status/{jobId}

# Get final results
GET /api/v1/documents/results/{jobId}

# List all jobs
GET /api/v1/documents/jobs?status=completed&limit=10

# Cancel a job
DELETE /api/v1/documents/jobs/{jobId}
```

### Monitoring

```bash
# Get processing metrics
GET /api/v1/documents/metrics

# Health check
GET /api/v1/documents/health
```

## 🔄 Processing Pipeline

### 1. Document Upload
- File validation (PDF, images, documents)
- Secure file storage
- Job creation with unique ID

### 2. Document Summary & Extraction
- LlamaParseReader processes document
- Extracts structured medical data
- Identifies physicians, facilities, lab parameters

### 3. Sequential Processing
```typescript
// Physician Matching (Sequential)
await physicianQueue.add('match-physician', {
  jobId,
  physicianInfo: { first_name, last_name, title },
  userId,
  language
});

// Facility Matching (Sequential, after physician)
await facilityQueue.add('match-facility', {
  jobId,
  facilityInfo: { facility_name, address },
  userId,
  language
}, { delay: 1000 }); // Ensures sequential processing
```

### 4. Parallel Processing
```typescript
// Lab Parameter Matching (Parallel with concurrency control)
const limit = pLimit(10); // Concurrency of 10

const promises = parameters.map((parameter) =>
  limit(async () => {
    return await langChainService.matchLabParameter({
      labReportInfo: parameter,
      userId,
      language
    });
  })
);

const results = await Promise.all(promises);
```

## 📊 Job Status Tracking

```typescript
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
```

## 🔧 Queue Management

The service uses 4 specialized queues:

1. **`document-processing`**: Main document processing pipeline
2. **`physician-matching`**: Sequential physician matching
3. **`facility-matching`**: Sequential facility matching
4. **`lab-parameter-matching`**: Parallel lab parameter matching

### Queue Configuration
- **Retry Logic**: 3 attempts with exponential backoff
- **Job Persistence**: Redis-based job storage
- **Concurrency Control**: Configurable per queue
- **Progress Tracking**: Real-time job progress updates

## 📈 Monitoring & Metrics

### Health Checks
```bash
GET /api/v1/documents/health
```

Response:
```json
{
  "success": true,
  "data": {
    "service": "Document Processing Service",
    "status": "healthy",
    "timestamp": "2025-07-14T06:32:00.000Z",
    "queues": {
      "document-processing": { "waiting": 0, "active": 1, "completed": 15, "failed": 0 },
      "physician-matching": { "waiting": 0, "active": 0, "completed": 12, "failed": 0 },
      "facility-matching": { "waiting": 0, "active": 0, "completed": 12, "failed": 0 },
      "lab-parameter-matching": { "waiting": 2, "active": 8, "completed": 45, "failed": 1 }
    }
  }
}
```

### Processing Metrics
```bash
GET /api/v1/documents/metrics
```

Response:
```json
{
  "success": true,
  "data": {
    "totalJobs": 84,
    "completedJobs": 72,
    "failedJobs": 1,
    "averageProcessingTime": 45000,
    "queueHealth": {
      "document-processing": { "waiting": 0, "active": 1, "completed": 15, "failed": 0 },
      "physician-matching": { "waiting": 0, "active": 0, "completed": 12, "failed": 0 },
      "facility-matching": { "waiting": 0, "active": 0, "completed": 12, "failed": 0 },
      "lab-parameter-matching": { "waiting": 2, "active": 8, "completed": 45, "failed": 1 }
    }
  }
}
```

## 🧪 Example Usage

```typescript
// Upload and process a document
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('userId', 'user123');
formData.append('language', 'en');

const response = await fetch('/api/v1/documents/process', {
  method: 'POST',
  body: formData
});

const { data } = await response.json();
const jobId = data.jobId;

// Poll for status
const checkStatus = async () => {
  const statusResponse = await fetch(`/api/v1/documents/status/${jobId}`);
  const { data: status } = await statusResponse.json();
  
  console.log(`Status: ${status.status}`);
  console.log(`Progress: ${JSON.stringify(status.progress, null, 2)}`);
  
  if (status.status === 'completed') {
    console.log('Results:', status.results);
  } else if (status.status === 'failed') {
    console.error('Error:', status.error);
  } else {
    // Continue polling
    setTimeout(checkStatus, 2000);
  }
};

checkStatus();
```

## 🔒 Security Features

- **File Type Validation**: Only allows medical document formats
- **File Size Limits**: Configurable upload size limits
- **Rate Limiting**: Throttling to prevent abuse
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses

## 🛠️ Development

```bash
# Run in development mode
npm run start:dev

# Run tests
npm run test

# Build for production
npm run build

# Lint code
npm run lint
```

## 📝 Dependencies

### Core Dependencies
- **NestJS**: Framework for building scalable Node.js applications
- **BullMQ**: Redis-based job queue for background processing
- **Redis**: In-memory data store for job persistence
- **LangChain**: AI/ML integration for document processing
- **Multer**: File upload handling
- **p-limit**: Concurrency control for parallel processing

### LangChain Integration
- **OpenAI**: GPT models for matching analysis
- **Anthropic**: Claude models for document extraction
- **LlamaIndex**: Document parsing and processing

## 🚀 Production Deployment

1. **Redis Setup**: Ensure Redis is running and accessible
2. **Environment Variables**: Configure all required API keys
3. **File Storage**: Set up persistent file storage
4. **Monitoring**: Configure logging and monitoring
5. **Scaling**: Use multiple worker instances for high throughput

## 📊 Performance Characteristics

- **Throughput**: Processes multiple documents concurrently
- **Latency**: Real-time status updates and progress tracking
- **Scalability**: Horizontal scaling with multiple worker instances
- **Reliability**: Automatic retry logic and error recovery
- **Efficiency**: Optimized concurrency control for lab parameter matching

## 🎯 Use Cases

- **Medical Document Processing**: Automated extraction and matching
- **Lab Report Analysis**: Parallel processing of multiple lab parameters
- **Healthcare Data Integration**: Physician and facility matching
- **Clinical Workflow Automation**: Background processing for medical systems
- **Research Data Processing**: Batch processing of medical documents

This service provides a robust, scalable solution for medical document processing with advanced job queue management and AI-powered matching capabilities.
