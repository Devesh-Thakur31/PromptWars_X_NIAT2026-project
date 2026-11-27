# PromptWars_X_NIAT2026-project

## PRIVY — Client-Side PII Detection & Redaction Engine

**PRIVY** is a 100% browser-based, client-side Personally Identifiable Information (PII) detection, validation, and redaction workspace built for **Google for Developers × Hack2Skill — Build with AI, Prompt Wars**.

> **Zero Network Transmission:** All document parsing, PII detection, redaction, and file export run strictly in browser memory. Original document contents are never sent to external servers or AI APIs, and are never persisted to `localStorage`.

### Key Capabilities

- **6 Supported PII Categories**
  - **Email addresses** (domain-label validated, trailing punctuation preserved)
  - **Phone numbers** (Indian & international formats, excluding numeric IDs)
  - **IPv4 addresses** (per-octet `0–255` validation, leading-zero & version-tag rejection)
  - **Indian PAN numbers** (`[A-Z]{5}[0-9]{4}[A-Z]`)
  - **Aadhaar-format numbers** (12-digit / `4-4-4` format validation; does not claim UIDAI authenticity verification)
  - **Credit card numbers** (Luhn mod-10 checksum + contextual exclusion for order/invoice/reference IDs + human-review flagging for ambiguous candidates)
- **3 Live Redaction Modes**
  - **Full Mask**: `[REDACTED]`
  - **Partial Mask**: Preserves non-sensitive suffixes/prefixes only (e.g., `j***@example.com`, `XXXXXX3210`, `XXXX-XXXX-XXXX-0366`)
  - **Consistent Pseudonymization**: Session-only deterministic placeholders (`USER_01`, `PHONE_01`, `PAN_01`, etc.) without exporting the mapping
- **Side-by-Side Comparison & Export**
  - Paste text, drag-and-drop or upload `.txt` / `.csv` files, or load the built-in noisy sample dataset
  - Safe JSX segment rendering (no `dangerouslySetInnerHTML`) with synchronized scrolling and real-time category statistics
  - Export sanitized `.txt` or `.csv` (preserving quoted fields, commas, and header context via PapaParse) using safe Blob URLs
- **Privacy-Safe Prompt & Processing Log**
  - Records deterministic processing actions, rules applied, mode, counts, status, and timestamps without storing original document text or sensitive values

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4, Lucide React
- **CSV Parsing**: PapaParse
- **Testing**: Vitest, React Testing Library

### Local Development & Verification

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run automated test suite (150 tests across 5 files)
npm test

# Type-check and build production bundle
npm run build
```

### License

Licensed under the Apache License 2.0 — see [LICENSE](./LICENSE).
