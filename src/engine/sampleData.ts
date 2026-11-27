/**
 * Built-in noisy sample dataset containing:
 * - All 6 PII categories (Email, Phone, IPv4, PAN, Aadhaar-format, Credit Card)
 * - Repeated values (to verify consistent pseudonymization)
 * - Invalid values (out-of-range IPv4 octets, Luhn-invalid card, malformed PAN)
 * - False-positive traps (Luhn-valid Order ID, Luhn-valid Invoice Ref, software version)
 * - Uncertain candidate flagged for human review
 */
export const SAMPLE_NOISY_DOCUMENT = `=== CUSTOMER SUPPORT & KYC INCIDENT LOG ===
Reported By: john@example.com, cc: priya.sharma@acme.co.in.
Follow-up Email (repeat): john@example.com
Primary Contact: 9876543210
Alternate Intl Phone: +1-415-555-0199
Callback Number (repeat): 9876543210

Identity & Tax Records:
- Primary PAN: ABCDE1234F
- Repeat PAN check: ABCDE1234F
- Malformed PAN (should ignore): AB12E1234F
- Aadhaar-format ID: 2345 6789 0123

Network Telemetry:
- Client IPv4: 192.168.1.45
- Gateway IPv4: 10.0.4.254
- Invalid IPv4 (should ignore): 999.168.1.1
- Out-of-range IPv4 (should ignore): 192.168.1.300
- App Release Tag (should ignore): v1.2.3.4

Payment & Order Reconciliation:
- Visa Card: 4532-0151-1283-0366
- Luhn-Invalid Card (should ignore): 4532-0151-1283-0367
- Order ID (Luhn-valid, must NOT redact): 4532015112830366
- Invoice Ref (Luhn-valid, must NOT redact): 5425233430109903
- Pending verification value (needs review): 7992739871312342
`;
