import Papa from 'papaparse';
import { detectPII } from '../engine/detector';
import { createPseudonymSession, redactText } from '../engine/redactor';
import type {
  RedactedDetection,
  RedactionMode,
  UploadedFileMeta,
} from '../types/pii';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB client-side safety limit
const ALLOWED_EXTENSIONS = new Set(['txt', 'csv']);

export type FileValidationResult =
  | { ok: true; content: string; meta: UploadedFileMeta }
  | { ok: false; error: string };

export function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  if (idx === -1) return '';
  return fileName.slice(idx + 1).toLowerCase();
}

/**
 * Validates file type, size, binary safety, and CSV structure without crashing.
 */
export function validateFileContent(
  fileName: string,
  fileSize: number,
  rawText: string
): FileValidationResult {
  const ext = getFileExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: `Unsupported file type "${ext ? `.${ext}` : 'unknown'}". Please upload a .txt or .csv file.`,
    };
  }

  if (fileSize === 0 || !rawText.trim()) {
    return {
      ok: false,
      error: `File "${fileName}" is empty. Provide a file with readable text or CSV data.`,
    };
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File "${fileName}" exceeds the 5 MB browser processing limit.`,
    };
  }

  // Reject binary/null-byte content disguised as .txt or .csv
  if (rawText.includes('\u0000')) {
    return {
      ok: false,
      error: `File "${fileName}" appears to contain binary or corrupted data and cannot be processed safely.`,
    };
  }

  if (ext === 'csv') {
    const parsed = Papa.parse<string[]>(rawText, {
      skipEmptyLines: false,
    });

    const criticalQuoteError = parsed.errors.find(
      (err) => err.type === 'Quotes'
    );
    if (criticalQuoteError) {
      return {
        ok: false,
        error: `Malformed CSV in "${fileName}" (row ${
          (criticalQuoteError.row ?? 0) + 1
        }): ${criticalQuoteError.message}. Check unclosed quotes.`,
      };
    }

    const nonEmptyRows = parsed.data.filter((row) =>
      row.some((cell) => cell.trim().length > 0)
    );
    if (nonEmptyRows.length === 0) {
      return {
        ok: false,
        error: `CSV file "${fileName}" contains no data rows.`,
      };
    }
  }

  return {
    ok: true,
    content: rawText,
    meta: {
      name: fileName,
      size: fileSize,
      type: ext as 'txt' | 'csv',
    },
  };
}

export async function readAndValidateUploadedFile(
  file: File
): Promise<FileValidationResult> {
  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: `Unsupported file type "${ext ? `.${ext}` : 'unknown'}". Only .txt and .csv files are supported.`,
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      error: `File "${file.name}" is empty (0 bytes).`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File "${file.name}" exceeds the 5 MB browser processing limit.`,
    };
  }

  try {
    const rawText = await file.text();
    return validateFileContent(file.name, file.size, rawText);
  } catch {
    return {
      ok: false,
      error: `Failed to read "${file.name}" in browser memory.`,
    };
  }
}

/**
 * Redacts a CSV document cell-by-cell while preserving row/column structure,
 * quoted fields, commas inside cells, and header-aware contextual exclusion.
 */
export function redactCsvDocument(
  rawCsv: string,
  mode: RedactionMode,
  reviewOverrides: Record<string, 'approved' | 'dismissed'> = {},
  existingDetections: RedactedDetection[] = []
): { ok: true; csv: string } | { ok: false; error: string } {
  const parsed = Papa.parse<string[]>(rawCsv, {
    skipEmptyLines: false,
  });

  const criticalQuoteError = parsed.errors.find(
    (err) => err.type === 'Quotes'
  );
  if (criticalQuoteError) {
    return {
      ok: false,
      error: `Cannot export CSV due to malformed quotes on row ${
        (criticalQuoteError.row ?? 0) + 1
      }.`,
    };
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    return { ok: false, error: 'Cannot export an empty CSV.' };
  }

  // Build value-level override map so UI review decisions apply accurately per cell during CSV export
  const valueOverrides = new Map<string, 'approved' | 'dismissed'>();
  for (const det of existingDetections) {
    const decision = reviewOverrides[det.id];
    if (decision) {
      valueOverrides.set(`${det.entityType}::${det.originalValue}`, decision);
    }
  }

  const buildCellOverrides = (
    cellDetections: { id: string; entityType: string; originalValue: string }[]
  ): Record<string, 'approved' | 'dismissed'> => {
    const mapped: Record<string, 'approved' | 'dismissed'> = {};
    for (const det of cellDetections) {
      const direct = reviewOverrides[det.id];
      const byValue = valueOverrides.get(
        `${det.entityType}::${det.originalValue}`
      );
      const resolved = byValue ?? direct;
      if (resolved) {
        mapped[det.id] = resolved;
      }
    }
    return mapped;
  };

  const session = createPseudonymSession();
  const headers = rows[0] ?? [];

  const redactedRows = rows.map((row, rowIndex) => {
    // Preserve trailing empty row if present at EOF
    if (row.length === 1 && row[0] === '' && rowIndex === rows.length - 1) {
      return row;
    }

    return row.map((cell, colIndex) => {
      if (!cell || !cell.trim()) {
        return cell;
      }

      // Include column header context for data rows so column-level exclusion (e.g. order_id) works reliably
      const headerLabel = rowIndex > 0 ? headers[colIndex]?.trim() : '';
      if (headerLabel) {
        const prefix = `${headerLabel}: `;
        const contextualInput = `${prefix}${cell}`;
        const detections = detectPII(contextualInput).filter(
          (d) => d.startIndex >= prefix.length
        );
        if (detections.length === 0) {
          return cell;
        }
        const shiftedDetections = detections.map((d) => ({
          ...d,
          startIndex: d.startIndex - prefix.length,
          endIndex: d.endIndex - prefix.length,
        }));
        return redactText(
          cell,
          shiftedDetections,
          mode,
          buildCellOverrides(shiftedDetections),
          session
        ).sanitizedText;
      }

      const detections = detectPII(cell);
      if (detections.length === 0) {
        return cell;
      }
      return redactText(
        cell,
        detections,
        mode,
        buildCellOverrides(detections),
        session
      ).sanitizedText;
    });
  });

  return {
    ok: true,
    csv: Papa.unparse(redactedRows),
  };
}

/**
 * Safely exports sanitized output via Blob + ObjectURL and revokes the URL immediately.
 */
export function downloadSanitizedBlob(
  sanitizedContent: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([sanitizedContent], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

export function buildSanitizedFileName(
  originalFileName: string | undefined,
  targetExt: 'txt' | 'csv'
): string {
  if (!originalFileName) {
    return `privy-sanitized.${targetExt}`;
  }
  const dotIdx = originalFileName.lastIndexOf('.');
  const baseName =
    dotIdx > 0 ? originalFileName.slice(0, dotIdx) : originalFileName;
  return `${baseName}-sanitized.${targetExt}`;
}
