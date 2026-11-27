export type PiiEntityType =
  | 'EMAIL'
  | 'PHONE'
  | 'IP'
  | 'PAN'
  | 'AADHAAR'
  | 'CREDIT_CARD';

export type RedactionMode = 'FULL_MASK' | 'PARTIAL_MASK' | 'PSEUDONYM';

export type ValidationStatus = 'valid' | 'format_match' | 'uncertain';

export type DetectionReviewStatus = 'confirmed' | 'needs_review';

export interface Detection {
  id: string;
  entityType: PiiEntityType;
  startIndex: number;
  endIndex: number;
  originalValue: string;
  validationStatus: ValidationStatus;
  reviewStatus: DetectionReviewStatus;
  reason?: string;
}

export interface RedactedDetection extends Detection {
  replacement: string;
  shouldRedact: boolean;
  userOverride?: 'approved' | 'dismissed';
}

export interface DetectionStats {
  totalDetected: number;
  emailCount: number;
  phoneCount: number;
  ipCount: number;
  panCount: number;
  aadhaarCount: number;
  creditCardCount: number;
  reviewRequiredCount: number;
  totalReplacements: number;
}

export interface PromptLogEntry {
  id: string;
  timestamp: string;
  action: string;
  rulesApplied: string[];
  redactionMode: RedactionMode;
  entitiesDetected: number;
  replacementsMade: number;
  status: 'success' | 'warning' | 'error';
  details?: string;
}

export interface UploadedFileMeta {
  name: string;
  size: number;
  type: 'txt' | 'csv';
}

export interface TextSegment {
  text: string;
  detection?: RedactedDetection;
  isRedactedSegment?: boolean;
}

export interface ProcessedDocument {
  originalText: string;
  sanitizedText: string;
  detections: RedactedDetection[];
  stats: DetectionStats;
  originalSegments: TextSegment[];
  sanitizedSegments: TextSegment[];
}
