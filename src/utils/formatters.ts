import type { PiiEntityType, RedactionMode } from '../types/pii';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const ENTITY_LABELS: Record<PiiEntityType, string> = {
  EMAIL: 'Email',
  PHONE: 'Phone',
  IP: 'IPv4',
  PAN: 'PAN',
  AADHAAR: 'Aadhaar',
  CREDIT_CARD: 'Card',
};

export const REDACTION_MODE_META: Record<
  RedactionMode,
  { label: string; description: string; example: string }
> = {
  FULL_MASK: {
    label: 'Full Mask',
    description: 'Replaces every confirmed entity with [REDACTED].',
    example: '[REDACTED]',
  },
  PARTIAL_MASK: {
    label: 'Partial Mask',
    description: 'Masks sensitive characters while keeping minimal suffix/domain.',
    example: 'j***@example.com',
  },
  PSEUDONYM: {
    label: 'Consistent Pseudonym',
    description: 'Assigns session-consistent category tokens (USER_01, PHONE_01).',
    example: 'USER_01',
  },
};
