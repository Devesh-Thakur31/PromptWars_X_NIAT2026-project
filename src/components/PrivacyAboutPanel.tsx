import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';

export function PrivacyAboutPanel() {
  const categories = [
    {
      name: 'Email Addresses',
      detail: 'RFC-style pattern matching without consuming trailing punctuation.',
    },
    {
      name: 'Phone Numbers',
      detail: 'Supports common Indian (+91 / 10-digit) and international E.164 formats.',
    },
    {
      name: 'IPv4 Addresses',
      detail: 'Validates all four octets individually (0–255) and ignores version strings.',
    },
    {
      name: 'Indian PAN Numbers',
      detail: 'Validates the 10-character alphanumeric PAN structure (AAAAA9999A).',
    },
    {
      name: 'Aadhaar-Format Numbers',
      detail: 'Detects 12-digit Aadhaar-format patterns (format check only; no UIDAI authenticity claim).',
    },
    {
      name: 'Credit Card Candidates',
      detail: 'Applies Luhn mod-10 checksum plus contextual exclusion to ignore order/invoice IDs.',
    },
  ];

  const guarantees = [
    'All parsing, detection, validation, and redaction run 100% locally in browser memory.',
    'Zero backend servers, zero external AI APIs, and zero telemetry or analytics.',
    'Original document contents and sensitive entities are never persisted to localStorage.',
    'Pseudonym mappings exist strictly in session memory and are never exported.',
    'Safe React JSX rendering only — never uses dangerouslySetInnerHTML.',
  ];

  return (
    <section
      aria-labelledby="privacy-about-heading"
      className="grid grid-cols-1 gap-5 lg:grid-cols-2"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-teal-600" aria-hidden="true" />
          <h2 id="privacy-about-heading" className="text-base font-semibold text-slate-900">
            Privacy &amp; Security Architecture
          </h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          PRIVY is a deterministic, client-side PII redaction engine built so sensitive documents never leave your device before sanitization.
        </p>

        <ul className="mt-4 space-y-2.5">
          {guarantees.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-teal-600"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-900">
            Supported PII Categories &amp; Validation
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
            >
              <h3 className="text-xs font-semibold text-slate-900">{cat.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {cat.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
