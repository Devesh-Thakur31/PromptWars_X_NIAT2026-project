import { describe, expect, it } from 'vitest';
import { detectPII } from '../engine/detector';
import { isValidIPv4, isValidLuhn, isValidPAN } from '../engine/validators';

describe('PII Detection & Validation Engine', () => {
  it('detects valid emails without consuming trailing punctuation and rejects invalid domains', () => {
    const text =
      'Reach out to john@example.com, or cc priya.sharma@acme.co.in. Bad: john@bad-.com';
    const detections = detectPII(text);
    const emails = detections.filter((d) => d.entityType === 'EMAIL');

    expect(emails).toHaveLength(2);
    expect(emails[0].originalValue).toBe('john@example.com');
    expect(emails[1].originalValue).toBe('priya.sharma@acme.co.in');
    expect(text.slice(emails[0].startIndex, emails[0].endIndex)).toBe(
      'john@example.com'
    );
  });

  it('detects Indian and international phone formats while excluding numeric IDs', () => {
    const text =
      'Mobile: 9876543210 | India: +91 98765 43210 | US: +1-415-555-0199 | UK: +44 7911 123456 | SG: +65 9123 4567 | AU: +61 412 345 678 | Ref: 9876543210';
    const phones = detectPII(text).filter((d) => d.entityType === 'PHONE');

    expect(phones.map((p) => p.originalValue)).toEqual([
      '9876543210',
      '+91 98765 43210',
      '+1-415-555-0199',
      '+44 7911 123456',
      '+65 9123 4567',
      '+61 412 345 678',
    ]);
  });

  it('validates IPv4 octets and rejects invalid IPv4 addresses', () => {
    expect(isValidIPv4('192.168.1.45')).toBe(true);
    expect(isValidIPv4('255.255.255.0')).toBe(true);
    expect(isValidIPv4('999.168.1.1')).toBe(false);
    expect(isValidIPv4('192.168.1.300')).toBe(false);
    expect(isValidIPv4('192.168.01.1')).toBe(false);

    const text =
      'Valid 10.0.4.254, invalid 999.168.1.1, invalid 192.168.1.256, release v1.2.3.4';
    const ips = detectPII(text).filter((d) => d.entityType === 'IP');

    expect(ips).toHaveLength(1);
    expect(ips[0].originalValue).toBe('10.0.4.254');
  });

  it('detects valid Indian PAN numbers and rejects malformed PANs', () => {
    expect(isValidPAN('ABCDE1234F')).toBe(true);
    expect(isValidPAN('AB12E1234F')).toBe(false);

    const text = 'PAN: ABCDE1234F, bad: AB12E1234F, lowercase: abcde1234f';
    const pans = detectPII(text).filter((d) => d.entityType === 'PAN');

    expect(pans).toHaveLength(1);
    expect(pans[0].originalValue).toBe('ABCDE1234F');
  });

  it('detects 12-digit Aadhaar-format numbers', () => {
    const text = 'Aadhaar-format ID: 2345 6789 0123 and 2345-6789-0124';
    const aadhaar = detectPII(text).filter((d) => d.entityType === 'AADHAAR');

    expect(aadhaar).toHaveLength(2);
    expect(aadhaar[0].originalValue).toBe('2345 6789 0123');
    expect(aadhaar[1].originalValue).toBe('2345-6789-0124');
  });

  it('detects Luhn-valid credit cards and rejects Luhn-invalid numbers', () => {
    expect(isValidLuhn('4532015112830366')).toBe(true);
    expect(isValidLuhn('4532015112830367')).toBe(false);

    const text =
      'Card: 4532-0151-1283-0366 and invalid card: 4532-0151-1283-0367';
    const cards = detectPII(text).filter((d) => d.entityType === 'CREDIT_CARD');

    expect(cards).toHaveLength(1);
    expect(cards[0].originalValue).toBe('4532-0151-1283-0366');
    expect(cards[0].reviewStatus).toBe('confirmed');
  });

  it('excludes Luhn-valid order and reference IDs using contextual rules', () => {
    const text =
      'Order ID: 4532015112830366 | Invoice Ref: 5425233430109903 | Tracking No: 4111111111111111';
    const cards = detectPII(text).filter((d) => d.entityType === 'CREDIT_CARD');

    expect(cards).toHaveLength(0);
  });

  it('flags uncertain Luhn-valid candidates for review instead of blindly confirming them', () => {
    const text = 'Pending verification value: 7992739871312342';
    const detections = detectPII(text);
    const cards = detections.filter((d) => d.entityType === 'CREDIT_CARD');

    expect(cards).toHaveLength(1);
    expect(cards[0].reviewStatus).toBe('needs_review');
  });

  it('prevents overlapping detections across categories', () => {
    const text =
      'Email: user9876543210@example.com | Card: 4532-0151-1283-0366';
    const detections = detectPII(text);

    expect(detections).toHaveLength(2);
    expect(detections.map((d) => d.entityType)).toEqual([
      'EMAIL',
      'CREDIT_CARD',
    ]);
    for (let i = 1; i < detections.length; i++) {
      expect(detections[i].startIndex).toBeGreaterThanOrEqual(
        detections[i - 1].endIndex
      );
    }
  });

  it('returns empty array for empty input', () => {
    expect(detectPII('')).toEqual([]);
  });
});
