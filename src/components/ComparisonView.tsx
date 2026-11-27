import { useRef } from 'react';
import { Eye, ShieldCheck } from 'lucide-react';
import type { PiiEntityType, TextSegment } from '../types/pii';
import { ENTITY_LABELS } from '../utils/formatters';

interface ComparisonViewProps {
  originalSegments: TextSegment[];
  sanitizedSegments: TextSegment[];
  hasInput: boolean;
}

const ENTITY_BADGE_STYLES: Record<PiiEntityType, string> = {
  EMAIL: 'bg-blue-100 text-blue-900 border-blue-300',
  PHONE: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  IP: 'bg-slate-200 text-slate-900 border-slate-300',
  PAN: 'bg-amber-100 text-amber-900 border-amber-300',
  AADHAAR: 'bg-orange-100 text-orange-900 border-orange-300',
  CREDIT_CARD: 'bg-rose-100 text-rose-900 border-rose-300',
};

export function ComparisonView({
  originalSegments,
  sanitizedSegments,
  hasInput,
}: ComparisonViewProps) {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  const handleScroll = (source: 'left' | 'right') => {
    if (syncingRef.current) return;
    const from = source === 'left' ? leftRef.current : rightRef.current;
    const to = source === 'left' ? rightRef.current : leftRef.current;
    if (!from || !to) return;

    syncingRef.current = true;
    to.scrollTop = from.scrollTop;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  return (
    <section
      aria-label="Side-by-side comparison"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      {/* LEFT PANEL: Original Input */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">
              Original Content
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Detected entities highlighted
          </span>
        </div>

        <div
          ref={leftRef}
          onScroll={() => handleScroll('left')}
          tabIndex={0}
          aria-label="Original content panel"
          className="h-96 overflow-y-auto p-4 font-mono text-sm leading-6 text-slate-800 whitespace-pre-wrap break-words"
        >
          {!hasInput ? (
            <div className="flex h-full items-center justify-center font-sans text-sm text-slate-500">
              Paste text, upload a TXT/CSV file, or click Load Sample Data to inspect detections.
            </div>
          ) : (
            originalSegments.map((seg, idx) => {
              if (!seg.detection) {
                return <span key={idx}>{seg.text}</span>;
              }
              const det = seg.detection;
              const isReview =
                det.reviewStatus === 'needs_review' && !det.userOverride;
              const badgeStyle = isReview
                ? 'bg-amber-100 text-amber-900 border-amber-300 border-dashed'
                : ENTITY_BADGE_STYLES[det.entityType];

              return (
                <mark
                  key={det.id}
                  title={`${ENTITY_LABELS[det.entityType]} (${det.validationStatus})`}
                  className={`inline-flex items-baseline gap-1 rounded border px-1 py-0.5 ${badgeStyle}`}
                >
                  <span>{seg.text}</span>
                  <span className="rounded bg-white/80 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    {isReview ? 'REVIEW' : ENTITY_LABELS[det.entityType]}
                  </span>
                </mark>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Sanitized Output */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">
              Sanitized Output
            </h3>
          </div>
          <span className="text-xs text-teal-700">
            Safe for sharing &amp; export
          </span>
        </div>

        <div
          ref={rightRef}
          onScroll={() => handleScroll('right')}
          tabIndex={0}
          aria-label="Sanitized output panel"
          className="h-96 overflow-y-auto p-4 font-mono text-sm leading-6 text-slate-800 whitespace-pre-wrap break-words"
        >
          {!hasInput ? (
            <div className="flex h-full items-center justify-center font-sans text-sm text-slate-500">
              Sanitized output will appear here in real time.
            </div>
          ) : (
            sanitizedSegments.map((seg, idx) => {
              if (!seg.detection) {
                return <span key={idx}>{seg.text}</span>;
              }
              const det = seg.detection;
              if (!seg.isRedactedSegment) {
                return (
                  <span
                    key={det.id}
                    title="Flagged for review or kept original by user"
                    className="rounded border border-dashed border-amber-300 bg-amber-50 px-1 py-0.5 text-slate-800"
                  >
                    {seg.text}
                  </span>
                );
              }

              return (
                <span
                  key={det.id}
                  data-testid="sanitized-replacement"
                  className="inline-flex items-baseline gap-1 rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 font-semibold text-teal-900"
                >
                  <span>{seg.text}</span>
                  <span className="rounded bg-white/80 px-1 text-[10px] font-medium uppercase tracking-wide text-teal-700">
                    {ENTITY_LABELS[det.entityType]}
                  </span>
                </span>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
