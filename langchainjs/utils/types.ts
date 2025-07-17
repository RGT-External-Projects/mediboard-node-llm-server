// Core data types based on Python implementation

export interface LabParameter {
  parameter: string;
  id: number;
}

export interface LabReportInfo {
  name: string;
  test_type?: string;
  result?: string;
  units?: string;
  range?: string;
  comment?: string;
  comment_english?: string;
}

export interface LabReportItem {
  matched_id?: number;
  matched_parameter?: string;
  match_info: {
    match_score: string;
    reason: string;
  };
  test_params: LabReportInfo;
  
}

export interface PhysicianInfo {
  first_name?: string;
  last_name?: string;
  title?: string;
  specialty?: string;
}

export interface MedicalFacility {
  facility_name?: string;
  address?: string;
  phone?: string;
  department?: string;
}

export interface UploadedFileContent {
  test_date?: string;
  patient_info?: {
    name?: string;
    id?: string;
    age?: string;
    gender?: string;
  };
  physician_info?: PhysicianInfo;
  medical_facility?: MedicalFacility;
  lab_reports: LabReportInfo[];
}

export interface ProcessingResult {
  status: boolean;
  message: string;
  data: any;
}

export interface VectorSearchResult {
  content: string;
  metadata: LabParameter;
  score: number;
}

export enum ModelType {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  GROQ = 'groq'
}

export interface ModelConfig {
  type: ModelType;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface LlamaParseConfig {
  apiKey: string;
  resultType: 'markdown' | 'text';
  language: string[];
  parseMode: 'parse_document_with_agent' | 'simple';
  model: string;
}

export interface LlamaParseApiConfig {
  parseMode?: string;
  vendorMultimodalModelName?: string;
  structuredOutput?: boolean;
  disableOcr?: boolean;
  disableImageExtraction?: boolean;
  adaptiveLongTable?: boolean;
  annotateLinks?: boolean;
  doNotUnrollColumns?: boolean;
  htmlMakeAllElementsVisible?: boolean;
  htmlRemoveNavigationElements?: boolean;
  htmlRemoveFixedElements?: boolean;
  guessXlsxSheetName?: boolean;
  doNotCache?: boolean;
  invalidateCache?: boolean;
  outputPdfOfDocument?: boolean;
  takeScreenshot?: boolean;
  isFormattingInstruction?: boolean;
  timeout?: number;
}

export interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  progress?: number;
  error?: string;
}

export interface DocumentSummaryRequest {
  filePath: string;
  userId: string;
  language: string;
}

export interface LabMatchingRequest {
  labReportInfo: LabReportInfo;
  userId: string;
  language: string;
}

export interface PhysicianMatchingRequest {
  physicianInfo: PhysicianInfo;
  userId: string;
  language: string;
}

export interface MedicalFacilityMatchingRequest {
  facilityInfo: MedicalFacility;
  userId: string;
  language: string;
}

export interface MatchedPhysicianInfo {
  matched_id?: number;
  matched_title?: string;
  matched_name?: string;
  matched_lastname?: string;
  match_info: {
    match_score: string;
    reason: string;
  };
}

export interface MatchedMedicalFacilityInfo {
  value_name?: string;
  matched_display_name?: string;
  matched_id?: number;
  match_info: {
    match_score: string;
    reason: string;
  };
}

export interface VectorStoreConfig {
  embeddingModel: string;
  searchK: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

// Utility types for better type safety
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}
