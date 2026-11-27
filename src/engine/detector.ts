import type { Detection, PiiEntityType } from '../types/pii';
import {
  evaluateAadhaarContext,
  evaluateCardContext,
  isExcludedPhoneContext,
  isValidAadhaarFormat,
  isValidEmail,
  isValidIPv4,
  isValidLuhn,
  isValidPAN,
  isVersionOrMalformedIpContext,
} from './validators';

const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
const IPV4_REGEX = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const CARD_REGEX = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
const AADHAAR_REGEX =
  /(?<!\d)(?<!\d[\s-])(?<!\+\d{0,3}\s)(?:[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}|[2-9]\d{11})(?![\s-]?\d)/g;
const PHONE_REGEX =
  /(?<!\d)(?<!\d[\s-])(?:\+(?:91|1|44|61|65|971|49|33|81|86|[1-9]\d{0,2})[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\b0)?(?:[6-9]\d{9}|[6-9]\d{4}[\s.-]\d{5}|[6-9]\d{2}[\s.-]\d{3}[\s.-]\d{4}|\d{3}[\s.-]\d{3}[\s.-]\d{4}|\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}|\d{2,4}[\s.-]\d{3,4}[\s.-]\d{4}|(?<=\+\d{1,3}[\s.-])(?:\d{4}[\s.-]\d{4,6}|\d{2,4}(?:[\s.-]\d{3,4}){1,2}))(?![\s-]?\d)/g;

const ENTITY_PRIORITY: Record<PiiEntityType, number> = {
  EMAIL: 6,
  CREDIT_CARD: 5,
  PAN: 4,
  AADHAAR: 3,
  IP: 2,
  PHONE: 1,
};

function overlaps(a: Detection, b: Detection): boolean {
  return a.startIndex < b.endIndex && b.startIndex < a.endIndex;
}

function isWordBoundaryBefore(text: string, index: number): boolean {
  if (index === 0) return true;
  return !/[A-Za-z0-9_]/.test(text[index - 1]);
}

function isWordBoundaryAfter(text: string, index: number): boolean {
  if (index >= text.length) return true;
  return !/[A-Za-z0-9_]/.test(text[index]);
}

/**
 * Detects PII entities across all six supported categories with format validation,
 * Luhn checksum + contextual exclusion rules, review flagging, and overlap resolution.
 */
export function detectPII(text: string): Detection[] {
  if (!text) {
    return [];
  }

  const candidates: Detection[] = [];
  let seq = 0;

  const nextId = (type: PiiEntityType) => `${type}_${++seq}`;

  // 1. Emails (without consuming trailing punctuation)
  for (const match of text.matchAll(EMAIL_REGEX)) {
    const value = match[0];
    const start = match.index ?? 0;
    const end = start + value.length;

    if (!isWordBoundaryBefore(text, start)) continue;
    if (!isWordBoundaryAfter(text, end)) continue;
    if (!isValidEmail(value)) continue;

    candidates.push({
      id: nextId('EMAIL'),
      entityType: 'EMAIL',
      startIndex: start,
      endIndex: end,
      originalValue: value,
      validationStatus: 'valid',
      reviewStatus: 'confirmed',
      reason: 'RFC-style email pattern validated',
    });
  }

  // 2. Indian PAN
  for (const match of text.matchAll(PAN_REGEX)) {
    const value = match[0];
    const start = match.index ?? 0;
    const end = start + value.length;

    if (!isValidPAN(value)) continue;

    candidates.push({
      id: nextId('PAN'),
      entityType: 'PAN',
      startIndex: start,
      endIndex: end,
      originalValue: value,
      validationStatus: 'valid',
      reviewStatus: 'confirmed',
      reason: 'Standard 10-character PAN structure',
    });
  }

  // 3. Credit Card Numbers (Luhn + contextual exclusion)
  for (const match of text.matchAll(CARD_REGEX)) {
    const rawValue = match[0].trim();
    const leadingTrim = match[0].indexOf(rawValue);
    const start = (match.index ?? 0) + leadingTrim;
    const end = start + rawValue.length;

    // Must not start/end with hyphen/space and must not contain mixed separators inconsistently
    if (!/^\d[\d\s-]+\d$/.test(rawValue)) continue;

    // Reject phone-like '+...' prefix
    if (start > 0 && text[start - 1] === '+') continue;

    const digitsOnly = rawValue.replace(/[\s-]/g, '');
    if (!isValidLuhn(digitsOnly)) {
      continue;
    }

    const contextResult = evaluateCardContext(text, start, end, digitsOnly);
    if (contextResult === 'exclude') {
      continue;
    }

    candidates.push({
      id: nextId('CREDIT_CARD'),
      entityType: 'CREDIT_CARD',
      startIndex: start,
      endIndex: end,
      originalValue: rawValue,
      validationStatus: contextResult === 'confirmed' ? 'valid' : 'uncertain',
      reviewStatus: contextResult === 'confirmed' ? 'confirmed' : 'needs_review',
      reason:
        contextResult === 'confirmed'
          ? 'Luhn checksum passed with card BIN/context'
          : 'Luhn checksum passed without clear card context; review recommended',
    });
  }

  // 4. Aadhaar-format 12-digit numbers
  for (const match of text.matchAll(AADHAAR_REGEX)) {
    const rawValue = match[0];
    const start = match.index ?? 0;
    const end = start + rawValue.length;

    if (start > 0 && text[start - 1] === '+') continue;
    if (!isValidAadhaarFormat(rawValue)) continue;

    const contextResult = evaluateAadhaarContext(text, start, end, rawValue);
    if (contextResult === 'exclude') {
      continue;
    }

    candidates.push({
      id: nextId('AADHAAR'),
      entityType: 'AADHAAR',
      startIndex: start,
      endIndex: end,
      originalValue: rawValue,
      validationStatus:
        contextResult === 'confirmed' ? 'format_match' : 'uncertain',
      reviewStatus: contextResult === 'confirmed' ? 'confirmed' : 'needs_review',
      reason:
        contextResult === 'confirmed'
          ? '12-digit Aadhaar-format pattern (format check only)'
          : 'Unformatted 12-digit number; review recommended',
    });
  }

  // 5. IPv4 Addresses (individual octet validation 0..255)
  for (const match of text.matchAll(IPV4_REGEX)) {
    const value = match[0];
    const start = match.index ?? 0;
    const end = start + value.length;

    if (!isValidIPv4(value)) continue;
    if (isVersionOrMalformedIpContext(text, start, end)) continue;

    candidates.push({
      id: nextId('IP'),
      entityType: 'IP',
      startIndex: start,
      endIndex: end,
      originalValue: value,
      validationStatus: 'valid',
      reviewStatus: 'confirmed',
      reason: 'All 4 IPv4 octets validated (0-255)',
    });
  }

  // 6. Phone numbers (Indian & International)
  for (const match of text.matchAll(PHONE_REGEX)) {
    const rawValue = match[0].trim();
    const leadingOffset = match[0].indexOf(rawValue);
    const start = (match.index ?? 0) + leadingOffset;
    const end = start + rawValue.length;

    if (!isWordBoundaryAfter(text, end)) continue;
    if (start > 0 && /[A-Za-z0-9_.]/.test(text[start - 1])) continue;

    const digitsOnly = rawValue.replace(/\D/g, '');

    // Validate digit count: E.164 international 8..15 digits, Indian 10 digits or 11 with leading 0 or 12 with 91
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      // Allow explicit international +XX... with 8-9 digits only when '+' prefix is present
      if (!(rawValue.startsWith('+') && digitsOnly.length >= 8)) {
        continue;
      }
    }

    // Reject plain unformatted 10-digit numbers not starting with 6-9 unless formatted as phone or +prefixed
    const hasPhoneFormatting = /[+()\s.-]/.test(rawValue);
    if (!hasPhoneFormatting && digitsOnly.length === 10 && !/^[6-9]/.test(digitsOnly)) {
      continue;
    }

    // Reject date-like patterns such as 2026-11-27 or 12-05-2025
    if (/^\d{2,4}[-.]\d{2}[-.]\d{2,4}$/.test(rawValue)) {
      continue;
    }

    if (isExcludedPhoneContext(text, start, end)) {
      continue;
    }

    candidates.push({
      id: nextId('PHONE'),
      entityType: 'PHONE',
      startIndex: start,
      endIndex: end,
      originalValue: rawValue,
      validationStatus: 'valid',
      reviewStatus: 'confirmed',
      reason: rawValue.startsWith('+')
        ? 'International phone format validated'
        : 'Phone number format validated',
    });
  }

  // Resolve overlaps: confirmed > needs_review, higher priority > lower, longer > shorter, earlier > later
  const sortedCandidates = [...candidates].sort((a, b) => {
    const aConfirmed = a.reviewStatus === 'confirmed' ? 1 : 0;
    const bConfirmed = b.reviewStatus === 'confirmed' ? 1 : 0;
    if (aConfirmed !== bConfirmed) {
      return bConfirmed - aConfirmed;
    }

    const priorityDiff =
      ENTITY_PRIORITY[b.entityType] - ENTITY_PRIORITY[a.entityType];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const lenDiff =
      b.endIndex - b.startIndex - (a.endIndex - a.startIndex);
    if (lenDiff !== 0) {
      return lenDiff;
    }

    return a.startIndex - b.startIndex;
  });

  const accepted: Detection[] = [];
  for (const candidate of sortedCandidates) {
    // Do not let an unconfirmed candidate overlap an already accepted detection,
    // and do not let any two accepted detections overlap.
    if (accepted.some((existing) => overlaps(existing, candidate))) {
      continue;
    }
    accepted.push(candidate);
  }

  return accepted.sort((a, b) => a.startIndex - b.startIndex);
}
