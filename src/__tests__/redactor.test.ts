import { describe, expect, it } from 'vitest';
import { detectPII } from '../engine/detector';
import { partialMaskValue, redactText } from '../engine/redactor';

describe('Redaction Modes Engine', () => {
  it('applies FULL_MASK mode correctly', () => {
    const input = 'Email: john@example.com, Phone: 9876543210, PAN: ABCDE1234F';
    const detections = detectPII(input);
    const { sanitizedText } = redactText(input, detections, 'FULL_MASK');

    expect(sanitizedText).toBe(
      'Email: [REDACTED], Phone: [REDACTED], PAN: [REDACTED]'
    );
  });

  it('applies PARTIAL_MASK mode without exposing full sensitive values', () => {
    expect(partialMaskValue('EMAIL', 'john@example.com')).toBe(
      'j***@example.com'
    );
    expect(partialMaskValue('PHONE', '9876543210')).toBe('XXXXXX3210');
    expect(partialMaskValue('CREDIT_CARD', '1234567812341234')).toBe(
      'XXXX-XXXX-XXXX-1234'
    );
    expect(partialMaskValue('IP', '192.168.1.45')).toBe('XXX.XXX.XXX.45');
    expect(partialMaskValue('AADHAAR', '2345 6789 0123')).toBe(
      'XXXX-XXXX-0123'
    );

    const panMasked = partialMaskValue('PAN', 'ABCDE1234F');
    expect(panMasked).not.toBe('ABCDE1234F');
    expect(panMasked.startsWith('XXXXXX')).toBe(true);
  });

  it('maintains consistent pseudonyms for repeated values and separate counters per category', () => {
    const input = [
      'First email: john@example.com',
      'Second email: alice@example.com',
      'Repeat email: john@example.com',
      'Phone 1: 9876543210',
      'Phone 2: 9876543210',
      'PAN: ABCDE1234F',
      'PAN repeat: ABCDE1234F',
    ].join('\n');

    const detections = detectPII(input);
    const { sanitizedText } = redactText(input, detections, 'PSEUDONYM');

    expect(sanitizedText).toContain('First email: USER_01');
    expect(sanitizedText).toContain('Second email: USER_02');
    expect(sanitizedText).toContain('Repeat email: USER_01');
    expect(sanitizedText).toContain('Phone 1: PHONE_01');
    expect(sanitizedText).toContain('Phone 2: PHONE_01');
    expect(sanitizedText).toContain('PAN: PAN_01');
    expect(sanitizedText).toContain('PAN repeat: PAN_01');
    expect(sanitizedText).not.toContain('john@example.com');
    expect(sanitizedText).not.toContain('9876543210');
    expect(sanitizedText).not.toContain('ABCDE1234F');
  });

  it('does not redact needs_review items unless explicitly approved', () => {
    const input = 'Pending verification value: 7992739871312342';
    const detections = detectPII(input);
    expect(detections).toHaveLength(1);
    expect(detections[0].reviewStatus).toBe('needs_review');

    const defaultResult = redactText(input, detections, 'FULL_MASK');
    expect(defaultResult.sanitizedText).toBe(input);

    const approvedResult = redactText(input, detections, 'FULL_MASK', {
      [detections[0].id]: 'approved',
    });
    expect(approvedResult.sanitizedText).toBe(
      'Pending verification value: [REDACTED]'
    );
  });
});
