/**
 * Validation and contextual exclusion utilities for PRIVY PII Detection Engine.
 * All checks run locally in browser memory with zero external calls.
 */

const EXCLUSION_KEYWORDS_PATTERN =
  /\b(order(?:[_\s-]?id|[_\s-]?no|[_\s-]?number|[_\s-]?num)?|ord|ref(?:erence)?(?:[_\s-]?(?:id|no|number|num))?|invoice(?:[_\s-]?(?:id|no|number|num))?|inv|tracking(?:[_\s-]?(?:id|no|number|num))?|shipment|awb|waybill|docket|txnid|txn(?:[_\s-]?(?:id|no|number|num))?|transaction(?:[_\s-]?(?:id|no|ref|number|num))?|booking(?:[_\s-]?(?:id|no|ref|number|num))?|ticket(?:[_\s-]?(?:id|no|number|num))?|po[_\s-]?(?:id|no|number|num)?|receipt(?:[_\s-]?(?:id|no|number|num))?|serial(?:[_\s-]?(?:id|no|number|num))?|imei|sku|batch|utr|rrn|(?:account|customer|client|user|member|consumer|meter|case)[_\s-]?(?:id|no|number|num)?|confirmation(?:[_\s-]?(?:code|id|no|number|num))?)\b/gi;

const CARD_CONTEXT_PATTERN =
  /\b(card(?:[_\s-]?(?:no|num|number))?|credit(?:\s+card)?|debit(?:\s+card)?|visa|mastercard|amex|american\s+express|rupay|discover|diners|jcb|cc|payment|cvv|expiry)\b/gi;

const AADHAAR_CONTEXT_PATTERN =
  /\b(aadhaar|aadhar|uid|uidai|e-?kyc|kyc|vid)\b/gi;

const PHONE_EXCLUSION_PATTERN =
  /\b(order(?:[_\s-]?id|[_\s-]?no|[_\s-]?number|[_\s-]?num)?|ord|ref(?:erence)?(?:[_\s-]?(?:id|no|number|num))?|invoice(?:[_\s-]?(?:id|no|number|num))?|inv|tracking(?:[_\s-]?(?:id|no|number|num))?|shipment|awb|waybill|docket|txnid|txn(?:[_\s-]?(?:id|no|number|num))?|transaction(?:[_\s-]?(?:id|no|ref|number|num))?|booking(?:[_\s-]?(?:id|no|ref|number|num))?|ticket(?:[_\s-]?(?:id|no|number|num))?|po[_\s-]?(?:id|no|number|num)?|receipt(?:[_\s-]?(?:id|no|number|num))?|serial(?:[_\s-]?(?:id|no|number|num))?|sku|utr|rrn|(?:account|customer|client|user|member|consumer|meter|case)[_\s-]?(?:id|no|number|num)?|timestamp|epoch|port|zip|pin(?:code)?)\b/gi;

const PHONE_CONTEXT_PATTERN =
  /\b(phone|ph|mobile|mob|tel|telephone|cell|contact|call|callback|whatsapp|fax|helpline)\b/gi;

const VERSION_PREFIX_PATTERN =
  /(?:v|ver|version|release|rel|build|tag)[_\s.:#-]*$/i;

function getLastMatchIndex(pattern: RegExp, input: string): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  let lastIndex = -1;
  for (const match of input.matchAll(re)) {
    if (typeof match.index === 'number') {
      lastIndex = match.index;
    }
  }
  return lastIndex;
}

/**
 * Validates a digit-only string using the Luhn (mod-10) checksum algorithm.
 */
export function isValidLuhn(digitsOnly: string): boolean {
  if (!/^\d{13,19}$/.test(digitsOnly)) {
    return false;
  }

  // Reject trivial all-identical digits (e.g., 0000000000000000)
  if (/^(\d)\1+$/.test(digitsOnly)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let digit = digitsOnly.charCodeAt(i) - 48;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Checks whether digits match common payment card network IIN/BIN ranges.
 */
export function hasRecognizedCardBin(digitsOnly: string): boolean {
  return (
    /^4\d{12}(?:\d{3})?(?:\d{3})?$/.test(digitsOnly) || // Visa (13, 16, 19)
    /^(?:5[1-5]\d{14}|2(?:22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)\d{12})$/.test(
      digitsOnly
    ) || // Mastercard (16)
    /^3[47]\d{13}$/.test(digitsOnly) || // Amex (15)
    /^6(?:011|5\d{2})\d{12}$/.test(digitsOnly) || // Discover (16)
    /^(?:60|6521|6522|81|82|508)\d{10,17}$/.test(digitsOnly) || // RuPay
    /^3(?:0[0-5]|[68]\d)\d{11}$/.test(digitsOnly) || // Diners Club (14)
    /^(?:2131|1800|35\d{3})\d{11}$/.test(digitsOnly) // JCB (15-16)
  );
}

/**
 * Validates an IPv4 address by checking each octet individually (0-255, no leading zeros like 01).
 */
export function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return false;
  }

  for (const part of parts) {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) {
      return false;
    }
    const num = Number(part);
    if (num < 0 || num > 255) {
      return false;
    }
  }

  return true;
}

/**
 * Validates standard Indian PAN structure: 5 uppercase letters, 4 digits, 1 uppercase letter.
 */
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
}

/**
 * Validates 12-digit Aadhaar-format candidate (starts with 2-9, not all identical digits).
 * Note: Format validation only; does not claim UIDAI authenticity verification.
 */
export function isValidAadhaarFormat(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^[2-9]\d{11}$/.test(digits)) {
    return false;
  }
  if (/^(\d)\1{11}$/.test(digits)) {
    return false;
  }
  return true;
}

/**
 * Validates email structure without trailing punctuation or consecutive dots.
 */
export function isValidEmail(email: string): boolean {
  if (email.includes('..')) {
    return false;
  }
  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex === email.length - 1) {
    return false;
  }
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (local.startsWith('.') || local.endsWith('.')) {
    return false;
  }
  const domainLabels = domain.split('.');
  if (
    domainLabels.length < 2 ||
    domainLabels.some(
      (label) => !label || label.startsWith('-') || label.endsWith('-')
    )
  ) {
    return false;
  }
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
}

/**
 * Extracts the immediate preceding label/context on the same line (up to 72 chars before startIndex)
 * and the trailing segment on the same line (up to 48 chars after endIndex).
 */
export function getLineContext(
  text: string,
  startIndex: number,
  endIndex: number
): { before: string; after: string; immediateClause: string } {
  const lineStart = text.lastIndexOf('\n', startIndex - 1) + 1;
  const lineEndRaw = text.indexOf('\n', endIndex);
  const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;

  const beforeStart = Math.max(lineStart, startIndex - 72);
  const before = text.slice(beforeStart, startIndex);
  const rawAfter = text.slice(endIndex, Math.min(lineEnd, endIndex + 48));

  // Narrow down to the closest clause after common separators (ignoring commas inside parentheses)
  let parenDepth = 0;
  let lastDelimiter = -1;
  for (let i = 0; i < before.length; i++) {
    const ch = before[i];
    if (ch === '(') parenDepth += 1;
    else if (ch === ')' && parenDepth > 0) parenDepth -= 1;
    else if (parenDepth === 0 && (ch === ',' || ch === ';' || ch === '|')) {
      lastDelimiter = i;
    }
  }
  const immediateClause =
    lastDelimiter !== -1 ? before.slice(lastDelimiter + 1) : before;

  // Truncate `after` at the first clause separator outside parentheses so subsequent fields don't bleed back
  let afterParenDepth = 0;
  let firstAfterDelimiter = -1;
  for (let i = 0; i < rawAfter.length; i++) {
    const ch = rawAfter[i];
    if (ch === '(') afterParenDepth += 1;
    else if (ch === ')' && afterParenDepth > 0) afterParenDepth -= 1;
    else if (afterParenDepth === 0 && (ch === ',' || ch === ';' || ch === '|')) {
      firstAfterDelimiter = i;
      break;
    }
  }
  const after =
    firstAfterDelimiter !== -1 ? rawAfter.slice(0, firstAfterDelimiter) : rawAfter;

  return { before, after, immediateClause };
}

/**
 * Evaluates contextual cues for a Luhn-valid numeric candidate.
 * Compares the closest exclusion keyword vs card keyword in both preceding and following context.
 */
export function evaluateCardContext(
  text: string,
  startIndex: number,
  endIndex: number,
  digitsOnly: string
): 'exclude' | 'confirmed' | 'needs_review' {
  const { immediateClause, before, after } = getLineContext(
    text,
    startIndex,
    endIndex
  );

  // Check preceding context (immediate clause first, then before)
  const lastExclusionBefore = Math.max(
    getLastMatchIndex(EXCLUSION_KEYWORDS_PATTERN, immediateClause),
    getLastMatchIndex(EXCLUSION_KEYWORDS_PATTERN, before)
  );
  const lastCardBefore = Math.max(
    getLastMatchIndex(CARD_CONTEXT_PATTERN, immediateClause),
    getLastMatchIndex(CARD_CONTEXT_PATTERN, before)
  );

  if (lastExclusionBefore > lastCardBefore) {
    return 'exclude';
  }

  if (lastCardBefore >= 0) {
    return 'confirmed';
  }

  // Check following context for post-fixed labels (e.g. "4532015112830366 (Order ID)")
  const firstExclusionAfter = after.search(EXCLUSION_KEYWORDS_PATTERN);
  const firstCardAfter = after.search(CARD_CONTEXT_PATTERN);
  if (
    firstExclusionAfter !== -1 &&
    (firstCardAfter === -1 || firstExclusionAfter < firstCardAfter)
  ) {
    return 'exclude';
  }

  if (firstCardAfter !== -1 && firstExclusionAfter === -1) {
    return 'confirmed';
  }

  if (hasRecognizedCardBin(digitsOnly)) {
    return 'confirmed';
  }

  return 'needs_review';
}

/**
 * Evaluates contextual cues for a 12-digit Aadhaar-format candidate.
 */
export function evaluateAadhaarContext(
  text: string,
  startIndex: number,
  endIndex: number,
  rawValue: string
): 'exclude' | 'confirmed' | 'needs_review' {
  const { immediateClause, before, after } = getLineContext(
    text,
    startIndex,
    endIndex
  );

  const lastExclusionBefore = Math.max(
    getLastMatchIndex(EXCLUSION_KEYWORDS_PATTERN, immediateClause),
    getLastMatchIndex(EXCLUSION_KEYWORDS_PATTERN, before)
  );
  const lastAadhaarBefore = Math.max(
    getLastMatchIndex(AADHAAR_CONTEXT_PATTERN, immediateClause),
    getLastMatchIndex(AADHAAR_CONTEXT_PATTERN, before)
  );

  if (lastExclusionBefore > lastAadhaarBefore) {
    return 'exclude';
  }

  const firstExclusionAfter = after.search(EXCLUSION_KEYWORDS_PATTERN);
  const firstAadhaarAfter = after.search(AADHAAR_CONTEXT_PATTERN);
  if (
    firstExclusionAfter !== -1 &&
    (firstAadhaarAfter === -1 || firstExclusionAfter < firstAadhaarAfter)
  ) {
    return 'exclude';
  }

  if (lastAadhaarBefore >= 0 || firstAadhaarAfter !== -1) {
    return 'confirmed';
  }

  // Formatted 4-4-4 (e.g. 2345 6789 0123 or 2345-6789-0123) is strongly Aadhaar-format
  if (/^\d{4}[\s-]\d{4}[\s-]\d{4}$/.test(rawValue)) {
    return 'confirmed';
  }

  // Bare 12-digit continuous number without Aadhaar keyword could be an account/ID -> flag for review
  return 'needs_review';
}

/**
 * Checks whether an IPv4 match is actually a software version number (e.g. v1.2.3.4) or >4 octets.
 */
export function isVersionOrMalformedIpContext(
  text: string,
  startIndex: number,
  endIndex: number
): boolean {
  const beforeChar = startIndex > 0 ? text[startIndex - 1] : '';
  const afterChar = endIndex < text.length ? text[endIndex] : '';

  if (beforeChar === '.' || afterChar === '.') {
    return true;
  }

  const prefixWindow = text.slice(Math.max(0, startIndex - 16), startIndex);
  return VERSION_PREFIX_PATTERN.test(prefixWindow);
}

/**
 * Checks whether a phone candidate sits inside an obvious non-phone numeric ID label
 * unless a closer phone-related keyword overrides it.
 */
export function isExcludedPhoneContext(
  text: string,
  startIndex: number,
  endIndex: number
): boolean {
  const { immediateClause, before, after } = getLineContext(
    text,
    startIndex,
    endIndex
  );
  const lastExclusionBefore = Math.max(
    getLastMatchIndex(PHONE_EXCLUSION_PATTERN, immediateClause),
    getLastMatchIndex(PHONE_EXCLUSION_PATTERN, before)
  );
  const lastPhoneBefore = Math.max(
    getLastMatchIndex(PHONE_CONTEXT_PATTERN, immediateClause),
    getLastMatchIndex(PHONE_CONTEXT_PATTERN, before)
  );

  if (lastExclusionBefore > lastPhoneBefore) {
    return true;
  }

  const firstExclusionAfter = after.search(PHONE_EXCLUSION_PATTERN);
  const firstPhoneAfter = after.search(PHONE_CONTEXT_PATTERN);
  if (
    firstExclusionAfter !== -1 &&
    (firstPhoneAfter === -1 || firstExclusionAfter < firstPhoneAfter)
  ) {
    return true;
  }

  return false;
}
