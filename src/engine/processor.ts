import { detectPII } from './detector';
import { createPseudonymSession, redactText } from './redactor';
import type {
  Detection,
  DetectionStats,
  ProcessedDocument,
  PromptLogEntry,
  RedactedDetection,
  RedactionMode,
  TextSegment,
} from '../types/pii';

interface CsvCellSpan {
  rowIndex: number;
  colIndex: number;
  rawStart: number;
  rawEnd: number;
  innerStart: number;
  innerEnd: number;
  value: string;
}

/**
 * Tokenizes CSV cell spans with exact character offsets in the source string.
 * Enables header-aware contextual exclusion in both live comparison and CSV export.
 */
function scanCsvCellSpans(csvText: string): CsvCellSpan[] {
  const spans: CsvCellSpan[] = [];
  let i = 0;
  let rowIndex = 0;
  let colIndex = 0;

  while (i < csvText.length) {
    const rawStart = i;
    if (csvText[i] === '"') {
      i += 1;
      const innerStart = i;
      let unescaped = '';
      while (i < csvText.length) {
        if (csvText[i] === '"') {
          if (csvText[i + 1] === '"') {
            unescaped += '"';
            i += 2;
            continue;
          }
          break;
        }
        unescaped += csvText[i];
        i += 1;
      }
      const innerEnd = i;
      if (csvText[i] === '"') {
        i += 1;
      }
      spans.push({
        rowIndex,
        colIndex,
        rawStart,
        rawEnd: i,
        innerStart,
        innerEnd,
        value: unescaped,
      });
    } else {
      const innerStart = i;
      while (
        i < csvText.length &&
        csvText[i] !== ',' &&
        csvText[i] !== '\n' &&
        csvText[i] !== '\r'
      ) {
        i += 1;
      }
      spans.push({
        rowIndex,
        colIndex,
        rawStart,
        rawEnd: i,
        innerStart,
        innerEnd: i,
        value: csvText.slice(innerStart, i),
      });
    }

    if (i < csvText.length && csvText[i] === ',') {
      colIndex += 1;
      i += 1;
      // Handle trailing empty cell at end of line/EOF
      if (i === csvText.length) {
        spans.push({
          rowIndex,
          colIndex,
          rawStart: i,
          rawEnd: i,
          innerStart: i,
          innerEnd: i,
          value: '',
        });
      }
    } else if (i < csvText.length && (csvText[i] === '\r' || csvText[i] === '\n')) {
      if (csvText[i] === '\r' && csvText[i + 1] === '\n') {
        i += 2;
      } else {
        i += 1;
      }
      rowIndex += 1;
      colIndex = 0;
    }
  }

  return spans;
}

/**
 * Runs PII detection, applying CSV column-header context when `isCsv` is true.
 */
export function detectDocument(
  originalText: string,
  isCsv = false
): Detection[] {
  if (!originalText.trim()) {
    return [];
  }

  if (!isCsv) {
    return detectPII(originalText);
  }

  const spans = scanCsvCellSpans(originalText);
  if (spans.length === 0) {
    return [];
  }

  const headers: string[] = [];
  for (const span of spans) {
    if (span.rowIndex === 0) {
      headers[span.colIndex] = span.value.trim();
    } else if (span.rowIndex > 0) {
      break;
    }
  }

  const detections: Detection[] = [];
  let seq = 0;

  for (const span of spans) {
    if (!span.value.trim()) continue;
    const rawSlice = originalText.slice(span.innerStart, span.innerEnd);
    const hasEscapedQuotes = rawSlice !== span.value;
    const headerLabel = span.rowIndex > 0 ? headers[span.colIndex] : '';

    const textToScan = headerLabel
      ? `${headerLabel}: ${span.value}`
      : span.value;
    const prefixLen = headerLabel ? headerLabel.length + 2 : 0;

    const cellDetections = detectPII(textToScan).filter(
      (d) => d.startIndex >= prefixLen
    );

    for (const det of cellDetections) {
      const localStart = det.startIndex - prefixLen;
      const localEnd = det.endIndex - prefixLen;
      if (hasEscapedQuotes) {
        // Fallback when raw slice contains "" escapes: locate exact substring in rawSlice
        const idx = rawSlice.indexOf(det.originalValue);
        if (idx === -1) continue;
        detections.push({
          ...det,
          id: `${det.entityType}_${++seq}`,
          startIndex: span.innerStart + idx,
          endIndex: span.innerStart + idx + det.originalValue.length,
        });
      } else {
        detections.push({
          ...det,
          id: `${det.entityType}_${++seq}`,
          startIndex: span.innerStart + localStart,
          endIndex: span.innerStart + localEnd,
        });
      }
    }
  }

  return detections.sort((a, b) => a.startIndex - b.startIndex);
}

export function computeDetectionStats(
  detections: RedactedDetection[]
): DetectionStats {
  const stats: DetectionStats = {
    totalDetected: detections.length,
    emailCount: 0,
    phoneCount: 0,
    ipCount: 0,
    panCount: 0,
    aadhaarCount: 0,
    creditCardCount: 0,
    reviewRequiredCount: 0,
    totalReplacements: 0,
  };

  for (const det of detections) {
    switch (det.entityType) {
      case 'EMAIL':
        stats.emailCount += 1;
        break;
      case 'PHONE':
        stats.phoneCount += 1;
        break;
      case 'IP':
        stats.ipCount += 1;
        break;
      case 'PAN':
        stats.panCount += 1;
        break;
      case 'AADHAAR':
        stats.aadhaarCount += 1;
        break;
      case 'CREDIT_CARD':
        stats.creditCardCount += 1;
        break;
    }

    if (det.reviewStatus === 'needs_review' && !det.userOverride) {
      stats.reviewRequiredCount += 1;
    }

    if (det.shouldRedact) {
      stats.totalReplacements += 1;
    }
  }

  return stats;
}

/**
 * Builds safe text segments for both Original and Sanitized views.
 * Rendered via standard React JSX elements (never dangerouslySetInnerHTML).
 */
export function buildComparisonSegments(
  originalText: string,
  detections: RedactedDetection[]
): { originalSegments: TextSegment[]; sanitizedSegments: TextSegment[] } {
  if (!originalText) {
    return { originalSegments: [], sanitizedSegments: [] };
  }

  const sorted = [...detections].sort((a, b) => a.startIndex - b.startIndex);
  const originalSegments: TextSegment[] = [];
  const sanitizedSegments: TextSegment[] = [];

  let cursor = 0;

  for (const det of sorted) {
    if (det.startIndex > cursor) {
      const plain = originalText.slice(cursor, det.startIndex);
      originalSegments.push({ text: plain });
      sanitizedSegments.push({ text: plain });
    }

    originalSegments.push({
      text: originalText.slice(det.startIndex, det.endIndex),
      detection: det,
      isRedactedSegment: false,
    });

    sanitizedSegments.push({
      text: det.replacement,
      detection: det,
      isRedactedSegment: det.shouldRedact,
    });

    cursor = det.endIndex;
  }

  if (cursor < originalText.length) {
    const tail = originalText.slice(cursor);
    originalSegments.push({ text: tail });
    sanitizedSegments.push({ text: tail });
  }

  return { originalSegments, sanitizedSegments };
}

/**
 * Redacts pre-detected entities and computes stats and comparison segments in O(detections).
 */
export function redactDocument(
  originalText: string,
  detections: Detection[],
  mode: RedactionMode,
  reviewOverrides: Record<string, 'approved' | 'dismissed'> = {}
): ProcessedDocument {
  if (!originalText.trim()) {
    return {
      originalText,
      sanitizedText: originalText,
      detections: [],
      stats: computeDetectionStats([]),
      originalSegments: originalText ? [{ text: originalText }] : [],
      sanitizedSegments: originalText ? [{ text: originalText }] : [],
    };
  }

  const session = createPseudonymSession();
  const { sanitizedText, redactedDetections } = redactText(
    originalText,
    detections,
    mode,
    reviewOverrides,
    session
  );
  const stats = computeDetectionStats(redactedDetections);
  const { originalSegments, sanitizedSegments } = buildComparisonSegments(
    originalText,
    redactedDetections
  );

  return {
    originalText,
    sanitizedText,
    detections: redactedDetections,
    stats,
    originalSegments,
    sanitizedSegments,
  };
}

/**
 * Executes end-to-end client-side PII detection, redaction, segment generation, and stats aggregation.
 */
export function processDocument(
  originalText: string,
  mode: RedactionMode,
  reviewOverrides: Record<string, 'approved' | 'dismissed'> = {},
  isCsv = false
): ProcessedDocument {
  const detected = detectDocument(originalText, isCsv);
  return redactDocument(originalText, detected, mode, reviewOverrides);
}

/**
 * Creates a privacy-safe audit trace entry. Never records original document text or sensitive values.
 */
export function createPromptLogEntry(params: {
  action: string;
  redactionMode: RedactionMode;
  entitiesDetected: number;
  replacementsMade: number;
  status: 'success' | 'warning' | 'error';
  rulesApplied?: string[];
  details?: string;
}): PromptLogEntry {
  const defaultRules = [
    'EMAIL_RFC_BOUNDARY',
    'PHONE_IN_INTL',
    'IPV4_OCTET_RANGE',
    'PAN_STRUCTURE',
    'AADHAAR_FORMAT_12D',
    'LUHN_CARD_CONTEXT_EXCLUSION',
  ];

  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    action: params.action,
    rulesApplied: params.rulesApplied ?? defaultRules,
    redactionMode: params.redactionMode,
    entitiesDetected: params.entitiesDetected,
    replacementsMade: params.replacementsMade,
    status: params.status,
    details: params.details,
  };
}
