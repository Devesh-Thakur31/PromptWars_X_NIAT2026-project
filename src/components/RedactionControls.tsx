import type { KeyboardEvent } from 'react';
import { Check, Copy, Download, ShieldAlert } from 'lucide-react';
import type { RedactedDetection, RedactionMode } from '../types/pii';
import { ENTITY_LABELS, REDACTION_MODE_META } from '../utils/formatters';

interface RedactionControlsProps {
  mode: RedactionMode;
  onModeChange: (mode: RedactionMode) => void;
  onDownloadTxt: () => void;
  onDownloadCsv: () => void;
  onCopySanitized: () => void;
  copied: boolean;
  hasOutput: boolean;
  reviewDetections: RedactedDetection[];
  onReviewDecision: (id: string, decision: 'approved' | 'dismissed') => void;
}

const MODES: RedactionMode[] = ['FULL_MASK', 'PARTIAL_MASK', 'PSEUDONYM'];

export function RedactionControls({
  mode,
  onModeChange,
  onDownloadTxt,
  onDownloadCsv,
  onCopySanitized,
  copied,
  hasOutput,
  reviewDetections,
  onReviewDecision,
}: RedactionControlsProps) {
  return (
    <section
      aria-label="Redaction mode and export controls"
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Redaction Mode
          </h2>
          <div
            role="radiogroup"
            aria-label="Redaction mode"
            className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            {MODES.map((m, index) => {
              const meta = REDACTION_MODE_META[m];
              const selected = mode === m;
              const handleRadioKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  onModeChange(MODES[(index + 1) % MODES.length]);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  onModeChange(MODES[(index - 1 + MODES.length) % MODES.length]);
                }
              };
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onKeyDown={handleRadioKeyDown}
                  onClick={() => onModeChange(m)}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'border-blue-600 bg-blue-50/70 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{meta.label}</span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
                      {meta.example}
                    </code>
                  </div>
                  <span className="mt-1 text-[11px] leading-snug text-slate-500">
                    {meta.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:self-end">
          <button
            type="button"
            onClick={onCopySanitized}
            disabled={!hasOutput}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
                <span>Copied Safe Output</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy Output</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDownloadTxt}
            disabled={!hasOutput}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download TXT</span>
          </button>

          <button
            type="button"
            onClick={onDownloadCsv}
            disabled={!hasOutput}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {reviewDetections.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <span>
              Uncertain Candidates Flagged for Review ({reviewDetections.length})
            </span>
          </div>
          <p className="mt-0.5 text-xs text-amber-800">
            These candidates passed format/checksum checks without clear context and are preserved by default until approved.
          </p>
          <ul className="mt-2 space-y-1.5">
            {reviewDetections.map((det) => (
              <li
                key={det.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-1.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                    {ENTITY_LABELS[det.entityType]}
                  </span>
                  <code className="font-mono text-slate-800">
                    {det.originalValue}
                  </code>
                  <span className="text-slate-500">
                    (offset {det.startIndex}–{det.endIndex})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={det.userOverride === 'approved'}
                    onClick={() => onReviewDecision(det.id, 'approved')}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      det.userOverride === 'approved'
                        ? 'bg-teal-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:text-teal-800'
                    }`}
                  >
                    Approve Redaction
                  </button>
                  <button
                    type="button"
                    aria-pressed={det.userOverride === 'dismissed'}
                    onClick={() => onReviewDecision(det.id, 'dismissed')}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      det.userOverride === 'dismissed'
                        ? 'bg-slate-700 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Keep Original
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
