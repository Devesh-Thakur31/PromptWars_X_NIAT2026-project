import type {
  Detection,
  PiiEntityType,
  RedactedDetection,
  RedactionMode,
} from '../types/pii';

const PSEUDONYM_PREFIX: Record<PiiEntityType, string> = {
  EMAIL: 'USER',
  PHONE: 'PHONE',
  IP: 'IP',
  PAN: 'PAN',
  AADHAAR: 'AADHAAR',
  CREDIT_CARD: 'CARD',
};

/**
 * Normalizes a detected value within its entity category so repeated representations
 * (e.g., case differences in email, spacing in credit cards/Aadhaar) receive identical pseudonyms.
 */
function normalizeEntityKey(entityType: PiiEntityType, value: string): string {
  switch (entityType) {
    case 'EMAIL':
      return value.trim().toLowerCase();
    case 'PAN':
      return value.trim().toUpperCase();
    case 'PHONE': {
      const digits = value.replace(/\D/g, '');
      // Normalize Indian numbers with country code 91 or leading 0 to 10 digits
      if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
        return digits.slice(2);
      }
      if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
        return digits.slice(1);
      }
      // Normalize North American 11-digit numbers with leading 1 to 10 digits
      if (digits.length === 11 && digits.startsWith('1')) {
        return digits.slice(1);
      }
      return digits;
    }
    case 'CREDIT_CARD':
    case 'AADHAAR':
      return value.replace(/\D/g, '');
    case 'IP':
      return value.trim();
  }
}

/**
 * Generates a partial mask that never exposes the full original sensitive value.
 */
export function partialMaskValue(
  entityType: PiiEntityType,
  originalValue: string
): string {
  switch (entityType) {
    case 'EMAIL': {
      const atIdx = originalValue.indexOf('@');
      if (atIdx === -1) return '[REDACTED]';
      const local = originalValue.slice(0, atIdx);
      const domain = originalValue.slice(atIdx + 1);
      const visiblePrefix = local.length > 1 ? local[0] : '';
      return `${visiblePrefix}***@${domain}`;
    }

    case 'PHONE': {
      const digits = originalValue.replace(/\D/g, '');
      if (digits.length <= 4) {
        return 'X'.repeat(digits.length || 4);
      }
      const last4 = digits.slice(-4);
      const maskedLen = digits.length - 4;
      return `${'X'.repeat(maskedLen)}${last4}`;
    }

    case 'CREDIT_CARD': {
      const digits = originalValue.replace(/\D/g, '');
      if (digits.length <= 4) {
        return 'XXXX';
      }
      const last4 = digits.slice(-4);
      if (digits.length === 16) {
        return `XXXX-XXXX-XXXX-${last4}`;
      }
      if (digits.length === 15) {
        return `XXXX-XXXXXX-X${last4}`;
      }
      const maskedCount = digits.length - 4;
      const groups: string[] = [];
      for (let i = 0; i < maskedCount; i += 4) {
        groups.push('X'.repeat(Math.min(4, maskedCount - i)));
      }
      groups.push(last4);
      return groups.join('-');
    }

    case 'AADHAAR': {
      const digits = originalValue.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      return `XXXX-XXXX-${last4}`;
    }

    case 'PAN': {
      if (originalValue.length !== 10) {
        return 'XXXXXXXXXX';
      }
      return `XXXXXX${originalValue.slice(6)}`;
    }

    case 'IP': {
      const parts = originalValue.split('.');
      if (parts.length !== 4) {
        return 'XXX.XXX.XXX.XXX';
      }
      return `XXX.XXX.XXX.${parts[3]}`;
    }
  }
}

export interface PseudonymSession {
  getPlaceholder(entityType: PiiEntityType, originalValue: string): string;
}

/**
 * Creates an in-memory pseudonymization session with separate counters per category.
 * The mapping stays strictly in memory and is never exported or persisted.
 */
export function createPseudonymSession(): PseudonymSession {
  const maps: Record<PiiEntityType, Map<string, string>> = {
    EMAIL: new Map(),
    PHONE: new Map(),
    IP: new Map(),
    PAN: new Map(),
    AADHAAR: new Map(),
    CREDIT_CARD: new Map(),
  };

  const counters: Record<PiiEntityType, number> = {
    EMAIL: 0,
    PHONE: 0,
    IP: 0,
    PAN: 0,
    AADHAAR: 0,
    CREDIT_CARD: 0,
  };

  return {
    getPlaceholder(entityType: PiiEntityType, originalValue: string): string {
      const key = normalizeEntityKey(entityType, originalValue);
      const map = maps[entityType];
      const existing = map.get(key);
      if (existing) {
        return existing;
      }

      counters[entityType] += 1;
      const num = String(counters[entityType]).padStart(2, '0');
      const placeholder = `${PSEUDONYM_PREFIX[entityType]}_${num}`;
      map.set(key, placeholder);
      return placeholder;
    },
  };
}

/**
 * Computes replacement text for every detection and produces the sanitized string.
 * Uncertain detections (`needs_review`) are not redacted unless explicitly approved by the user.
 */
export function redactText(
  originalText: string,
  detections: Detection[],
  mode: RedactionMode,
  reviewOverrides: Record<string, 'approved' | 'dismissed'> = {},
  pseudonymSession: PseudonymSession = createPseudonymSession()
): { sanitizedText: string; redactedDetections: RedactedDetection[] } {
  const sorted = [...detections].sort((a, b) => a.startIndex - b.startIndex);
  const redactedDetections: RedactedDetection[] = [];

  let cursor = 0;
  const parts: string[] = [];

  for (const det of sorted) {
    const override = reviewOverrides[det.id];
    const shouldRedact =
      det.reviewStatus === 'confirmed'
        ? override !== 'dismissed'
        : override === 'approved';

    let replacement = det.originalValue;
    if (shouldRedact) {
      if (mode === 'FULL_MASK') {
        replacement = '[REDACTED]';
      } else if (mode === 'PARTIAL_MASK') {
        replacement = partialMaskValue(det.entityType, det.originalValue);
      } else {
        replacement = pseudonymSession.getPlaceholder(
          det.entityType,
          det.originalValue
        );
      }
    }

    parts.push(originalText.slice(cursor, det.startIndex));
    parts.push(replacement);
    cursor = det.endIndex;

    redactedDetections.push({
      ...det,
      replacement,
      shouldRedact,
      userOverride: override,
    });
  }

  parts.push(originalText.slice(cursor));

  return {
    sanitizedText: parts.join(''),
    redactedDetections,
  };
}
