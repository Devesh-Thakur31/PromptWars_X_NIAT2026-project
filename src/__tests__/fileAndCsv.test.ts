import { describe, expect, it } from 'vitest';
import { processDocument } from '../engine/processor';
import { SAMPLE_NOISY_DOCUMENT } from '../engine/sampleData';
import { redactCsvDocument, validateFileContent } from '../utils/fileHelpers';

describe('File Validation, CSV Handling, and Sample Data', () => {
  it('rejects unsupported file types', () => {
    const res = validateFileContent('secret.pdf', 1200, 'some content');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('Unsupported file type');
    }
  });

  it('rejects empty files', () => {
    const zeroBytes = validateFileContent('empty.txt', 0, '');
    expect(zeroBytes.ok).toBe(false);

    const whitespaceOnly = validateFileContent('blank.csv', 12, '   \n  ');
    expect(whitespaceOnly.ok).toBe(false);
  });

  it('rejects malformed CSV and binary content without crashing', () => {
    const badCsv = validateFileContent(
      'broken.csv',
      45,
      'name,email\n"Unclosed quote,john@example.com'
    );
    expect(badCsv.ok).toBe(false);
    if (!badCsv.ok) {
      expect(badCsv.error).toContain('Malformed CSV');
    }

    const binaryTxt = validateFileContent(
      'corrupt.txt',
      10,
      'abc\u0000def'
    );
    expect(binaryTxt.ok).toBe(false);
  });

  it('accepts valid TXT and CSV files', () => {
    const txt = validateFileContent('notes.txt', 25, 'Contact john@example.com');
    expect(txt.ok).toBe(true);

    const csv = validateFileContent(
      'users.csv',
      50,
      'name,email\n"Doe, John",john@example.com'
    );
    expect(csv.ok).toBe(true);
  });

  it('redacts CSV preserving rows, columns, quoted fields, commas, and header context', () => {
    const csvInput = [
      'name,email,order_id,card_number',
      '"Doe, John",john@example.com,4532015112830366,4532-0151-1283-0366',
      '"Smith, Jane",john@example.com,4532015112830366,4532-0151-1283-0366',
    ].join('\n');

    const result = redactCsvDocument(csvInput, 'PSEUDONYM');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const lines = result.csv.trim().split(/\r?\n/);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('name,email,order_id,card_number');
      // Quoted field with comma preserved, email pseudonymized consistently, order_id preserved, card redacted
      expect(lines[1]).toBe('"Doe, John",USER_01,4532015112830366,CARD_01');
      expect(lines[2]).toBe('"Smith, Jane",USER_01,4532015112830366,CARD_01');
    }
  });

  it('applies CSV header-aware exclusion in live document processing and carries review overrides to CSV export', () => {
    const csvInput = [
      'name,order_id,card_number,review_token',
      '"Doe, John",4532015112830366,4532-0151-1283-0366,7992739871312342',
    ].join('\n');

    const initial = processDocument(csvInput, 'FULL_MASK', {}, true);
    expect(initial.stats.creditCardCount).toBe(2); // card_number + review_token (order_id excluded)
    expect(initial.stats.reviewRequiredCount).toBe(1);
    expect(initial.sanitizedText).toContain('4532015112830366');
    expect(initial.sanitizedText).toContain('7992739871312342');

    const reviewItem = initial.detections.find(
      (d) => d.reviewStatus === 'needs_review'
    )!;
    const overrides = { [reviewItem.id]: 'approved' as const };
    const approvedDoc = processDocument(csvInput, 'FULL_MASK', overrides, true);
    const exported = redactCsvDocument(
      csvInput,
      'FULL_MASK',
      overrides,
      approvedDoc.detections
    );

    expect(exported.ok).toBe(true);
    if (exported.ok) {
      const lines = exported.csv.trim().split(/\r?\n/);
      expect(lines[1]).toBe('"Doe, John",4532015112830366,[REDACTED],[REDACTED]');
    }
  });

  it('sample dataset exercises all 6 PII categories, exclusions, and review items', () => {
    const processed = processDocument(SAMPLE_NOISY_DOCUMENT, 'PSEUDONYM');

    expect(processed.stats.emailCount).toBeGreaterThanOrEqual(3);
    expect(processed.stats.phoneCount).toBeGreaterThanOrEqual(3);
    expect(processed.stats.ipCount).toBe(2);
    expect(processed.stats.panCount).toBe(2);
    expect(processed.stats.aadhaarCount).toBe(1);
    expect(processed.stats.creditCardCount).toBe(2); // 1 confirmed Visa + 1 needs_review
    expect(processed.stats.reviewRequiredCount).toBe(1);

    // Order ID & Invoice Ref must NOT be redacted
    expect(processed.sanitizedText).toContain('4532015112830366');
    expect(processed.sanitizedText).toContain('5425233430109903');
    // Invalid IP & version tag must remain untouched
    expect(processed.sanitizedText).toContain('999.168.1.1');
    expect(processed.sanitizedText).toContain('v1.2.3.4');
    // Repeated values map consistently
    expect(processed.sanitizedText).toContain('USER_01');
    expect(processed.sanitizedText).toContain('PHONE_01');
    expect(processed.sanitizedText).toContain('PAN_01');
  });
});
