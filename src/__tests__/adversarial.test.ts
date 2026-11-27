/**
 * Adversarial edge-case test suite for the PRIVY PII detection and redaction engine.
 *
 * Tests:
 *  1. Luhn-valid order IDs (8+ context variants) must NEVER trigger card redaction
 *  2. Repeated entities across multiple paragraphs → consistent pseudonymization
 *  3. Overlapping detections → deterministic single winner per span
 *  4. Invalid IPv4 (octet >255, leading zeros, 5-octet strings, version strings)
 *  5. Malformed emails (invalid TLD, consecutive dots, empty local/domain parts, IDN misuse)
 *  6. Malformed phone numbers (too short, all same digit, US area-code-only)
 *  7. Empty and malformed upload validation
 *  8. CSV quoted fields, embedded commas, escaped double-quotes
 *  9. All three redaction mode switches (full→partial→pseudonym) with live output verification
 * 10. Preservation of unaffected surrounding text
 */

import { describe, expect, it } from 'vitest';
import { detectPII } from '../engine/detector';
import { partialMaskValue, redactText } from '../engine/redactor';
import { isValidIPv4, isValidEmail, isValidLuhn, isValidAadhaarFormat } from '../engine/validators';
import { processDocument } from '../engine/processor';
import { validateFileContent, redactCsvDocument } from '../utils/fileHelpers';

// ─── 1. LUHN-VALID ORDER IDS MUST NOT BECOME CREDIT CARDS ───────────────────

describe('Luhn-valid order/reference IDs — contextual exclusion', () => {
  const orderIdContexts: [string, string][] = [
    ['Order ID: ', '4532015112830366'],
    ['order_id: ', '4532015112830366'],
    ['Order No. ', '4532015112830366'],
    ['Ref: ', '5425233430109903'],
    ['Reference: ', '5425233430109903'],
    ['Invoice No: ', '4532015112830366'],
    ['Invoice Ref: ', '5425233430109903'],
    ['Tracking No: ', '4111111111111111'],  // Luhn-valid, tracking context
    ['Transaction Ref: ', '5425233430109903'],
    ['Booking ID: ', '4532015112830366'],
    ['Ticket No: ', '4532015112830366'],
    ['Confirmation No: ', '4532015112830366'],
    ['Customer ID: ', '4532015112830366'],
    ['Account No: ', '5425233430109903'],
    ['Serial No: ', '4532015112830366'],
    ['Receipt No: ', '4532015112830366'],
    ['po number: ', '4532015112830366'],
    ['TXN ID: ', '4532015112830366'],
    ['AWB: ', '4532015112830366'],
  ];

  for (const [label, number] of orderIdContexts) {
    it(`excludes "${label}${number}" from card detection`, () => {
      const text = `${label}${number}`;
      const cards = detectPII(text).filter(d => d.entityType === 'CREDIT_CARD');
      expect(cards).toHaveLength(0);
    });
  }

  it('detects card WHEN card keyword is present even with order ID elsewhere on line', () => {
    // Card keyword wins over distant order context
    const text = 'Visa card: 4532015112830366 (not an order id here)';
    const cards = detectPII(text).filter(d => d.entityType === 'CREDIT_CARD');
    expect(cards).toHaveLength(1);
    expect(cards[0].reviewStatus).toBe('confirmed');
  });

  it('post-fixed exclusion label: "4532015112830366 (Order ID)" must be excluded', () => {
    const text = 'Value: 4532015112830366 (Order ID)';
    const cards = detectPII(text).filter(d => d.entityType === 'CREDIT_CARD');
    expect(cards).toHaveLength(0);
  });

  it('needs_review when no context exists for Luhn-valid number without recognized BIN', () => {
    // 7992739871312342 is Luhn-valid, non-Visa/MC BIN, no context
    const text = 'Value: 7992739871312342';
    const cards = detectPII(text).filter(d => d.entityType === 'CREDIT_CARD');
    expect(cards).toHaveLength(1);
    expect(cards[0].reviewStatus).toBe('needs_review');
  });
});

// ─── 2. REPEATED ENTITIES ACROSS PARAGRAPHS ─────────────────────────────────

describe('Repeated entity pseudonymization across paragraphs', () => {
  it('gives same pseudonym to email repeated in 3 different paragraphs', () => {
    const text = [
      'Paragraph 1: Contact john@example.com for support.',
      '',
      'Paragraph 2: Please reach john@example.com directly.',
      '',
      'Paragraph 3: Final reminder for john@example.com.',
    ].join('\n');

    const { sanitizedText, redactedDetections: detections } = redactText(
      text,
      detectPII(text),
      'PSEUDONYM'
    );
    const emails = detections.filter(d => d.entityType === 'EMAIL');
    expect(emails).toHaveLength(3);
    // All three should map to same placeholder
    const placeholders = new Set(emails.map(e => e.replacement));
    expect(placeholders.size).toBe(1);
    expect(sanitizedText).not.toContain('john@example.com');
    // Count occurrences of USER_01
    const count = (sanitizedText.match(/USER_01/g) ?? []).length;
    expect(count).toBe(3);
  });

  it('assigns PHONE_01 for same number with and without country code', () => {
    const text = 'First: 9876543210\nThen: +91 9876543210\nAgain: 9876543210';
    const { redactedDetections } = redactText(text, detectPII(text), 'PSEUDONYM');
    const phones = redactedDetections.filter(d => d.entityType === 'PHONE');
    expect(phones.length).toBeGreaterThanOrEqual(2);
    const placeholders = new Set(phones.map(p => p.replacement));
    // Same normalized digits → same pseudonym
    expect(placeholders.size).toBe(1);
  });

  it('assigns different pseudonyms for different email addresses', () => {
    const text = 'Alice: alice@example.com | Bob: bob@example.com | Alice again: alice@example.com';
    const { sanitizedText, redactedDetections: detections } = redactText(
      text,
      detectPII(text),
      'PSEUDONYM'
    );
    const emails = detections.filter(d => d.entityType === 'EMAIL');
    expect(emails).toHaveLength(3);
    expect(sanitizedText).toContain('USER_01');
    expect(sanitizedText).toContain('USER_02');
    // alice appears twice → same placeholder
    const alicePlaceholders = emails
      .filter(e => e.originalValue === 'alice@example.com')
      .map(e => e.replacement);
    expect(new Set(alicePlaceholders).size).toBe(1);
  });

  it('assigns separate counters per category so EMAIL_01 and PHONE_01 coexist', () => {
    const text = 'Email: a@b.com Phone: 9876543210 PAN: ABCDE1234F IP: 10.0.0.1';
    const { sanitizedText } = redactText(text, detectPII(text), 'PSEUDONYM');
    expect(sanitizedText).toContain('USER_01');
    expect(sanitizedText).toContain('PHONE_01');
    expect(sanitizedText).toContain('PAN_01');
    expect(sanitizedText).toContain('IP_01');
  });

  it('repeated PAN (formatted same / different case) normalizes consistently', () => {
    const text = 'PAN: ABCDE1234F\nSame PAN again: ABCDE1234F';
    const { redactedDetections } = redactText(text, detectPII(text), 'PSEUDONYM');
    const pans = redactedDetections.filter(d => d.entityType === 'PAN');
    expect(pans).toHaveLength(2);
    const placeholders = new Set(pans.map(p => p.replacement));
    expect(placeholders.size).toBe(1);
    expect([...placeholders][0]).toBe('PAN_01');
  });
});

// ─── 3. OVERLAPPING DETECTIONS ───────────────────────────────────────────────

describe('Overlapping entity detection', () => {
  it('EMAIL wins over PHONE when digits are embedded in email local part', () => {
    const text = 'Contact: user9876543210@example.com';
    const detections = detectPII(text);
    expect(detections).toHaveLength(1);
    expect(detections[0].entityType).toBe('EMAIL');
  });

  it('no two accepted detections overlap', () => {
    const text =
      'Email: john@acme.co, PAN: ABCDE1234F, Card: 4532-0151-1283-0366, IP: 10.0.0.1, Phone: 9876543210';
    const detections = detectPII(text);
    for (let i = 0; i < detections.length; i++) {
      for (let j = i + 1; j < detections.length; j++) {
        const a = detections[i];
        const b = detections[j];
        const overlaps = a.startIndex < b.endIndex && b.startIndex < a.endIndex;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('credit card wins over Aadhaar when 16-digit Luhn-valid number with Visa BIN', () => {
    // Visa BIN 4532... is 16 digits; Aadhaar is 12 digits — no real overlap possible here
    // But test that a Luhn+BIN-valid 16-digit is classified as card, not aadhaar
    const text = 'Visa: 4532015112830366';
    const detections = detectPII(text);
    const types = detections.map(d => d.entityType);
    expect(types).toContain('CREDIT_CARD');
    expect(types).not.toContain('AADHAAR');
  });

  it('detections are returned in source order (ascending startIndex)', () => {
    const text = 'a@b.com 9876543210 10.0.0.1 ABCDE1234F';
    const detections = detectPII(text);
    for (let i = 1; i < detections.length; i++) {
      expect(detections[i].startIndex).toBeGreaterThan(detections[i - 1].startIndex);
    }
  });
});

// ─── 4. INVALID IPv4 REJECTION ───────────────────────────────────────────────

describe('IPv4 validation — invalid addresses must be rejected', () => {
  const invalidIPs = [
    '999.168.1.1',      // first octet > 255
    '192.168.1.300',    // last octet > 255
    '192.168.01.1',     // leading zero (not allowed)
    '192.168.1.1.1',    // 5 octets
    '192.168.1',        // 3 octets only
    '256.0.0.1',        // 256 > 255
    '0.0.0.256',        // 256 > 255
    '-1.0.0.1',         // negative
    '192.168..1',       // empty octet
    '1.2.3.4a',         // trailing char (boundary)
  ];

  for (const ip of invalidIPs) {
    it(`rejects invalid IPv4: "${ip}"`, () => {
      expect(isValidIPv4(ip)).toBe(false);
    });
  }

  const validIPs = [
    '0.0.0.0',
    '255.255.255.255',
    '192.168.1.1',
    '10.0.0.1',
    '172.16.254.1',
  ];

  for (const ip of validIPs) {
    it(`accepts valid IPv4: "${ip}"`, () => {
      expect(isValidIPv4(ip)).toBe(true);
    });
  }

  it('does not detect version string "v1.2.3.4" as an IP', () => {
    const text = 'App version v1.2.3.4 deployed.';
    const ips = detectPII(text).filter(d => d.entityType === 'IP');
    expect(ips).toHaveLength(0);
  });

  it('does not detect "build: 1.2.3.4" as IP', () => {
    const text = 'build: 1.2.3.4';
    const ips = detectPII(text).filter(d => d.entityType === 'IP');
    expect(ips).toHaveLength(0);
  });

  it('detects only valid IPs in a mixed list', () => {
    const text =
      'Valid: 192.168.1.45 10.0.4.254\nInvalid: 999.168.1.1 192.168.1.300 v1.2.3.4';
    const ips = detectPII(text).filter(d => d.entityType === 'IP');
    expect(ips).toHaveLength(2);
    expect(ips.map(d => d.originalValue)).toEqual(['192.168.1.45', '10.0.4.254']);
  });
});

// ─── 5. MALFORMED EMAIL REJECTION ────────────────────────────────────────────

describe('Malformed email rejection', () => {
  const invalidEmails = [
    'notanemail',
    '@nodomain.com',
    'missing@',
    'double..dots@example.com',
    '.starts@example.com',
    'ends.@example.com',
    'john@bad-.com',
    'john@-bad.com',
    'john@.example.com',
    'john@example..com',
  ];

  for (const email of invalidEmails) {
    it(`rejects malformed email: "${email}"`, () => {
      expect(isValidEmail(email)).toBe(false);
    });
  }

  it('does not detect malformed emails in text', () => {
    const text = 'Bad: notanemail double..dots@example.com .starts@example.com';
    const emails = detectPII(text).filter(d => d.entityType === 'EMAIL');
    expect(emails).toHaveLength(0);
  });

  it('detects only valid emails in a mixed list', () => {
    const text =
      'Good: john@example.com | Bad: missing@ | Good: alice@co.uk | Bad: @nodomain.com';
    const emails = detectPII(text).filter(d => d.entityType === 'EMAIL');
    expect(emails).toHaveLength(2);
    expect(emails[0].originalValue).toBe('john@example.com');
    expect(emails[1].originalValue).toBe('alice@co.uk');
  });

  it('does not consume trailing punctuation in email', () => {
    const text = 'Reply to: john@example.com.';
    const emails = detectPII(text).filter(d => d.entityType === 'EMAIL');
    expect(emails).toHaveLength(1);
    expect(emails[0].originalValue).toBe('john@example.com');
  });
});

// ─── 6. MALFORMED PHONE REJECTION ────────────────────────────────────────────

describe('Malformed phone number rejection', () => {
  it('rejects 5-digit number', () => {
    const text = 'Code: 12345';
    const phones = detectPII(text).filter(d => d.entityType === 'PHONE');
    expect(phones).toHaveLength(0);
  });

  it('rejects all-same-digit 10-digit number', () => {
    const text = 'Num: 1111111111';
    const phones = detectPII(text).filter(d => d.entityType === 'PHONE');
    expect(phones).toHaveLength(0);
  });

  it('rejects date-formatted strings as phone', () => {
    const text = 'DOB: 2026-11-27 and date 12.05.2025';
    const phones = detectPII(text).filter(d => d.entityType === 'PHONE');
    expect(phones).toHaveLength(0);
  });

  it('does not detect plain 10-digit number starting with 1 (not Indian mobile range)', () => {
    const text = 'Value: 1234567890';
    const phones = detectPII(text).filter(d => d.entityType === 'PHONE');
    expect(phones).toHaveLength(0);
  });

  it('detects valid Indian 10-digit mobile starting with 9', () => {
    const text = 'Mobile: 9876543210';
    const phones = detectPII(text).filter(d => d.entityType === 'PHONE');
    expect(phones).toHaveLength(1);
  });

  it('does not detect year timestamps like "20261127" as phone', () => {
    const text = 'Timestamp: 20261127';
    const phones = detectPII(text).filter(d => d.entityType === 'PHONE');
    expect(phones).toHaveLength(0);
  });
});

// ─── 7. EMPTY AND MALFORMED UPLOAD VALIDATION ────────────────────────────────

describe('File upload validation — empty and malformed files', () => {
  it('rejects 0-byte file', () => {
    const result = validateFileContent('empty.txt', 0, '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty/i);
  });

  it('rejects whitespace-only TXT', () => {
    const result = validateFileContent('blank.txt', 10, '   \n  \t  ');
    expect(result.ok).toBe(false);
  });

  it('rejects unsupported file extension .pdf', () => {
    const result = validateFileContent('secret.pdf', 500, 'some content');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Unsupported file type/i);
  });

  it('rejects file with no extension', () => {
    const result = validateFileContent('Makefile', 100, 'build: all');
    expect(result.ok).toBe(false);
  });

  it('rejects binary/null-byte content', () => {
    const result = validateFileContent('corrupt.txt', 10, 'abc\u0000def');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/binary|corrupted/i);
  });

  it('rejects CSV with unclosed quoted field', () => {
    const result = validateFileContent(
      'bad.csv',
      40,
      'name,email\n"Unclosed,john@example.com'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Malformed CSV/i);
  });

  it('rejects CSV with no data rows (only empty lines)', () => {
    const result = validateFileContent('empty-data.csv', 10, '\n\n\n');
    expect(result.ok).toBe(false);
  });

  it('accepts valid TXT file with PII content', () => {
    const result = validateFileContent(
      'report.txt',
      40,
      'Email: john@example.com'
    );
    expect(result.ok).toBe(true);
  });

  it('accepts well-formed CSV', () => {
    const result = validateFileContent(
      'leads.csv',
      60,
      'name,email\n"Doe, Jane",jane@example.com'
    );
    expect(result.ok).toBe(true);
  });

  it('rejects file over 5 MB limit', () => {
    const bigContent = 'a'.repeat(100);
    const result = validateFileContent('big.txt', 6 * 1024 * 1024, bigContent);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/5 MB/i);
  });
});

// ─── 8. CSV QUOTED FIELDS AND COMMAS ─────────────────────────────────────────

describe('CSV redaction — quoted fields, embedded commas, escaped quotes', () => {
  it('preserves comma inside quoted name field, redacts email correctly', () => {
    const csv = 'name,email\n"Doe, John",john@example.com\n"Smith, Jane",jane@example.com';
    const result = redactCsvDocument(csv, 'FULL_MASK');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.csv).toContain('"Doe, John"');
      expect(result.csv).toContain('"Smith, Jane"');
      expect(result.csv).not.toContain('john@example.com');
      expect(result.csv).not.toContain('jane@example.com');
      expect(result.csv).toContain('[REDACTED]');
    }
  });

  it('handles double-quote escaped fields ("") correctly', () => {
    const csv = 'notes\n"He said ""hello"" to alice@example.com"';
    const result = redactCsvDocument(csv, 'FULL_MASK');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.csv).not.toContain('alice@example.com');
    }
  });

  it('column header "order_id" suppresses card redaction on value column', () => {
    const csv = 'name,order_id,card_number\nAlice,4532015112830366,4532-0151-1283-0366';
    const result = redactCsvDocument(csv, 'FULL_MASK');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const lines = result.csv.split('\n');
      expect(lines[1]).toContain('4532015112830366'); // order_id preserved
      expect(lines[1]).toContain('[REDACTED]');         // card_number redacted
    }
  });

  it('pseudonym mode gives same placeholder across rows for same email', () => {
    const csv = 'name,email\nAlice,john@example.com\nBob,john@example.com';
    const result = redactCsvDocument(csv, 'PSEUDONYM');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const lines = result.csv.split('\n');
      // Both data rows should have same placeholder (trim \r for Windows line endings)
      expect(lines[1].split(',')[1].trim()).toBe(lines[2].split(',')[1].trim());
    }
  });

  it('CSV export output itself does not contain original sensitive values', () => {
    const csv = [
      'name,email,phone,pan',
      '"Sharma, Priya",priya@example.com,9876543210,ABCDE1234F',
    ].join('\n');
    const result = redactCsvDocument(csv, 'FULL_MASK');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.csv).not.toContain('priya@example.com');
      expect(result.csv).not.toContain('9876543210');
      expect(result.csv).not.toContain('ABCDE1234F');
    }
  });

  it('returns error for malformed CSV with unclosed quote', () => {
    const result = redactCsvDocument('name,email\n"Bad,john@example.com', 'FULL_MASK');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/malformed|quotes/i);
  });

  it('returns error for empty CSV', () => {
    const result = redactCsvDocument('', 'FULL_MASK');
    expect(result.ok).toBe(false);
  });
});

// ─── 9. REDACTION MODE SWITCHING ─────────────────────────────────────────────

describe('Redaction mode switching', () => {
  const input = 'Email: john@example.com | Phone: 9876543210 | PAN: ABCDE1234F | IP: 10.0.0.1 | Card: 4532-0151-1283-0366';
  const detections = detectPII(input);

  it('FULL_MASK replaces all with [REDACTED]', () => {
    const { sanitizedText } = redactText(input, detections, 'FULL_MASK');
    expect(sanitizedText).not.toContain('john@example.com');
    expect(sanitizedText).not.toContain('9876543210');
    expect(sanitizedText).not.toContain('ABCDE1234F');
    expect(sanitizedText).not.toContain('10.0.0.1');
    expect(sanitizedText).not.toContain('4532');
    expect((sanitizedText.match(/\[REDACTED\]/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('PARTIAL_MASK masks all without exposing full sensitive values', () => {
    const { sanitizedText } = redactText(input, detections, 'PARTIAL_MASK');
    expect(sanitizedText).toContain('j***@example.com');
    expect(sanitizedText).toContain('XXXXXX3210');
    expect(sanitizedText).toContain('XXXXXX234F');
    expect(sanitizedText).toContain('XXX.XXX.XXX.1');
    expect(sanitizedText).toContain('XXXX-XXXX-XXXX-0366');
    expect(sanitizedText).not.toContain('john@example.com');
    expect(sanitizedText).not.toContain('9876543210');
  });

  it('PSEUDONYM replaces all with category tokens', () => {
    const { sanitizedText } = redactText(input, detections, 'PSEUDONYM');
    expect(sanitizedText).toContain('USER_01');
    expect(sanitizedText).toContain('PHONE_01');
    expect(sanitizedText).toContain('PAN_01');
    expect(sanitizedText).toContain('IP_01');
    expect(sanitizedText).toContain('CARD_01');
    expect(sanitizedText).not.toContain('john@example.com');
  });

  it('switching mode on same detections produces different outputs without re-detecting', () => {
    const full = redactText(input, detections, 'FULL_MASK').sanitizedText;
    const partial = redactText(input, detections, 'PARTIAL_MASK').sanitizedText;
    const pseudonym = redactText(input, detections, 'PSEUDONYM').sanitizedText;

    expect(full).not.toBe(partial);
    expect(partial).not.toBe(pseudonym);
    expect(full).not.toBe(pseudonym);
  });

  it('processDocument PSEUDONYM gives consistent results on second call with same text', () => {
    const r1 = processDocument(input, 'PSEUDONYM');
    const r2 = processDocument(input, 'PSEUDONYM');
    // Both should produce same sanitized text (deterministic)
    expect(r1.sanitizedText).toBe(r2.sanitizedText);
  });
});

// ─── 10. PRESERVATION OF UNAFFECTED TEXT ─────────────────────────────────────

describe('Preservation of unaffected surrounding text', () => {
  it('leaves non-PII text completely untouched in FULL_MASK', () => {
    const input = 'Dear Customer, your email is john@example.com. Best regards, Support Team.';
    const detections = detectPII(input);
    const { sanitizedText } = redactText(input, detections, 'FULL_MASK');
    expect(sanitizedText).toContain('Dear Customer, your email is ');
    expect(sanitizedText).toContain('. Best regards, Support Team.');
    expect(sanitizedText).not.toContain('john@example.com');
  });

  it('preserves whitespace, newlines, and punctuation around detected entities', () => {
    const input = 'Line 1\nPhone: 9876543210.\nLine 3\n';
    const { sanitizedText } = redactText(input, detectPII(input), 'FULL_MASK');
    expect(sanitizedText).toMatch(/^Line 1\n/);
    expect(sanitizedText).toContain('Phone: [REDACTED].\n');
    expect(sanitizedText).toContain('\nLine 3\n');
  });

  it('sanitized text length is correct after replacement', () => {
    const input = 'ID: john@example.com end';
    const detections = detectPII(input);
    const { sanitizedText } = redactText(input, detections, 'FULL_MASK');
    // 'ID: ' + '[REDACTED]' + ' end'
    expect(sanitizedText).toBe('ID: [REDACTED] end');
  });

  it('source offsets (startIndex, endIndex) correctly slice out original value', () => {
    const text = 'Contact john@example.com and also 9876543210.';
    const detections = detectPII(text);
    for (const det of detections) {
      expect(text.slice(det.startIndex, det.endIndex)).toBe(det.originalValue);
    }
  });

  it('no entities detected → sanitized text equals original text exactly', () => {
    const input = 'The quick brown fox jumps over the lazy dog.';
    const { sanitizedText, redactedDetections } = redactText(input, detectPII(input), 'FULL_MASK');
    expect(redactedDetections).toHaveLength(0);
    expect(sanitizedText).toBe(input);
  });

  it('empty string input returns empty detections and empty sanitized text', () => {
    const result = processDocument('', 'FULL_MASK');
    expect(result.detections).toHaveLength(0);
    expect(result.sanitizedText).toBe('');
    expect(result.stats.totalDetected).toBe(0);
  });

  it('whitespace-only input returns no detections and unchanged text', () => {
    const input = '   \n   \t   ';
    const result = processDocument(input, 'FULL_MASK');
    expect(result.detections).toHaveLength(0);
    expect(result.sanitizedText).toBe(input);
  });
});

// ─── PARTIAL MASK — NEVER EXPOSE FULL ORIGINAL ───────────────────────────────

describe('Partial mask — no full original exposure', () => {
  it('EMAIL: only first character and domain visible', () => {
    const masked = partialMaskValue('EMAIL', 'john@example.com');
    expect(masked).toBe('j***@example.com');
    expect(masked).not.toContain('john');
  });

  it('EMAIL with single-char local part', () => {
    const masked = partialMaskValue('EMAIL', 'a@example.com');
    expect(masked).not.toContain('a@');
    // Single char local → no prefix shown
    expect(masked).toMatch(/\*+@example\.com/);
  });

  it('PHONE: only last 4 digits visible', () => {
    const masked = partialMaskValue('PHONE', '9876543210');
    expect(masked).toMatch(/^X+3210$/);
    expect(masked).not.toContain('9876');
  });

  it('CREDIT_CARD 16 digits: only last 4 visible in XXXX-XXXX-XXXX-NNNN format', () => {
    const masked = partialMaskValue('CREDIT_CARD', '4532-0151-1283-0366');
    expect(masked).toBe('XXXX-XXXX-XXXX-0366');
    expect(masked).not.toContain('4532');
    expect(masked).not.toContain('0151');
    expect(masked).not.toContain('1283');
  });

  it('AMEX 15 digits: last 4 visible', () => {
    const masked = partialMaskValue('CREDIT_CARD', '378282246310005');
    expect(masked).not.toContain('378282246310005');
    expect(masked).toMatch(/0005/);
  });

  it('PAN: only last 4 chars visible', () => {
    const masked = partialMaskValue('PAN', 'ABCDE1234F');
    expect(masked).toBe('XXXXXX234F');
    expect(masked).not.toContain('ABCDE');
  });

  it('AADHAAR: only last 4 digits visible', () => {
    const masked = partialMaskValue('AADHAAR', '2345 6789 0123');
    expect(masked).toBe('XXXX-XXXX-0123');
    expect(masked).not.toContain('2345');
  });

  it('IP: only last octet visible', () => {
    const masked = partialMaskValue('IP', '192.168.1.45');
    expect(masked).toBe('XXX.XXX.XXX.45');
    expect(masked).not.toContain('192');
  });
});

// ─── LUHN CHECKSUM UNIT TESTS ─────────────────────────────────────────────────

describe('Luhn checksum validation', () => {
  const validCards = [
    '4532015112830366',  // Visa
    '5425233430109903',  // Mastercard
    '378282246310005',   // Amex (15 digit) — real test vector
    '6011111111111117',  // Discover
    '3530111333300000',  // JCB
    '4111111111111111',  // Visa test
  ];
  const invalidCards = [
    '4532015112830367',  // Off by 1
    '1234567890123456',  // Random, Luhn-invalid
    '0000000000000000',  // All zeros
    '1111111111111111',  // All ones
    '4111111111111112',  // Off by 1
  ];

  for (const card of validCards) {
    it(`isValidLuhn("${card}") → true`, () => {
      expect(isValidLuhn(card)).toBe(true);
    });
  }
  for (const card of invalidCards) {
    it(`isValidLuhn("${card}") → false`, () => {
      expect(isValidLuhn(card)).toBe(false);
    });
  }
});

// ─── AADHAAR FORMAT UNIT TESTS ────────────────────────────────────────────────

describe('Aadhaar format validation', () => {
  it('accepts valid formatted 4-4-4', () => {
    expect(isValidAadhaarFormat('2345 6789 0123')).toBe(true);
  });
  it('accepts valid hyphenated 4-4-4', () => {
    expect(isValidAadhaarFormat('2345-6789-0123')).toBe(true);
  });
  it('accepts valid 12-digit continuous starting with 2-9', () => {
    expect(isValidAadhaarFormat('234567890123')).toBe(true);
  });
  it('rejects number starting with 0', () => {
    expect(isValidAadhaarFormat('012345678901')).toBe(false);
  });
  it('rejects number starting with 1', () => {
    expect(isValidAadhaarFormat('123456789012')).toBe(false);
  });
  it('rejects all-identical digits', () => {
    expect(isValidAadhaarFormat('222222222222')).toBe(false);
  });
  it('rejects 11-digit number', () => {
    expect(isValidAadhaarFormat('23456789012')).toBe(false);
  });
  it('rejects 13-digit number', () => {
    expect(isValidAadhaarFormat('2345678901234')).toBe(false);
  });
});
