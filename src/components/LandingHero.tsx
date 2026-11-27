import { ArrowDownRight, FileCheck2, Lock, ShieldCheck, Sparkles } from 'lucide-react';

interface LandingHeroProps {
  onStartSanitizing: () => void;
  onTrySample: () => void;
}

export function LandingHero({
  onStartSanitizing,
  onTrySample,
}: LandingHeroProps) {
  return (
    <section
      aria-labelledby="hero-headline"
      className="border-b border-stone-200/80 bg-[#FAF8F3] pb-12 pt-8 sm:pb-14 sm:pt-12"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left column: Editorial copy & CTAs */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/70 px-3 py-1 text-xs font-medium text-teal-800">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              <span>100% Client-Side · Zero Document Transmission</span>
            </div>

            <h2
              id="hero-headline"
              className="font-editorial mt-5 text-4xl font-normal leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]"
            >
              Share documents. Not sensitive data.
            </h2>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Detect, protect and sanitize sensitive information before sharing your
              documents.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={onStartSanitizing}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-xs transition-colors hover:bg-slate-800"
              >
                <span>Start sanitizing</span>
                <ArrowDownRight className="h-4 w-4 text-teal-300" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onTrySample}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 shadow-2xs transition-colors hover:border-teal-300 hover:bg-stone-50"
              >
                <Sparkles className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <span>Try sample document</span>
              </button>
            </div>

            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-stone-200/90 pt-5">
              <div>
                <dt className="text-xs font-medium text-slate-500">Categories</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                  6 PII Types
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Redaction</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                  3 Live Modes
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Processing</dt>
                <dd className="mt-0.5 text-sm font-semibold text-teal-800">
                  Browser Only
                </dd>
              </div>
            </dl>
          </div>

          {/* Right column: Floating Side-by-Side Product Preview */}
          <div className="lg:col-span-6">
            <div
              aria-label="Product preview showing original and sanitized document side by side"
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_14px_32px_-8px_rgba(15,23,42,0.08)] sm:p-5"
            >
              {/* Preview window bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-stone-300" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-full bg-stone-200" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-500">
                    customer_onboarding_notes.txt
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                  <FileCheck2 className="h-3 w-3" aria-hidden="true" />
                  4 Entities Protected · Order ID Preserved
                </span>
              </div>

              {/* Side-by-side preview panes */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {/* Original snippet */}
                <div className="rounded-xl border border-stone-200/90 bg-[#FCFBF8] p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Original
                    </span>
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      Detected PII
                    </span>
                  </div>
                  <div className="space-y-2 text-xs leading-relaxed text-slate-700">
                    <p>
                      Client:{' '}
                      <span className="rounded border border-amber-200 bg-amber-100/70 px-1 py-0.5 font-mono text-[11px] text-slate-900">
                        priya@acme.in
                      </span>{' '}
                      <span className="text-[10px] font-semibold text-amber-800">
                        EMAIL
                      </span>
                    </p>
                    <p>
                      Phone:{' '}
                      <span className="rounded border border-amber-200 bg-amber-100/70 px-1 py-0.5 font-mono text-[11px] text-slate-900">
                        +91 98765 43210
                      </span>{' '}
                      <span className="text-[10px] font-semibold text-amber-800">
                        PHONE
                      </span>
                    </p>
                    <p>
                      PAN:{' '}
                      <span className="rounded border border-amber-200 bg-amber-100/70 px-1 py-0.5 font-mono text-[11px] text-slate-900">
                        ABCDE1234F
                      </span>{' '}
                      <span className="text-[10px] font-semibold text-amber-800">
                        PAN
                      </span>
                    </p>
                    <p>
                      Card:{' '}
                      <span className="rounded border border-amber-200 bg-amber-100/70 px-1 py-0.5 font-mono text-[11px] text-slate-900">
                        4532-0151-1283-0366
                      </span>{' '}
                      <span className="text-[10px] font-semibold text-amber-800">
                        CARD
                      </span>
                    </p>
                    <p className="text-slate-500">
                      Order ID: <span className="font-mono text-[11px]">4532015112830366</span>
                    </p>
                  </div>
                </div>

                {/* Sanitized snippet */}
                <div className="rounded-xl border border-teal-200/80 bg-teal-50/25 p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800">
                      Sanitized
                    </span>
                    <span className="rounded bg-teal-100/80 px-1.5 py-0.5 text-[10px] font-medium text-teal-900">
                      Safe to Share
                    </span>
                  </div>
                  <div className="space-y-2 text-xs leading-relaxed text-slate-700">
                    <p>
                      Client:{' '}
                      <span className="rounded border border-teal-200 bg-teal-100/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-teal-900">
                        USER_01
                      </span>{' '}
                      <span className="text-[10px] font-semibold text-teal-700">
                        PSEUDONYM
                      </span>
                    </p>
                    <p>
                      Phone:{' '}
                      <span className="rounded border border-teal-200 bg-teal-100/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-teal-900">
                        XXXXXX3210
                      </span>{' '}
                      <span className="text-[10px] font-semibold text-teal-700">
                        PARTIAL
                      </span>
                    </p>
                    <p>
                      PAN:{' '}
                      <span className="rounded border border-teal-200 bg-teal-100/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-teal-900">
                        [REDACTED]
                      </span>{' '}
                      <span className="text-[10px] font-semibold text-teal-700">
                        MASKED
                      </span>
                    </p>
                    <p>
                      Card:{' '}
                      <span className="rounded border border-teal-200 bg-teal-100/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-teal-900">
                        XXXX-XXXX-XXXX-0366
                      </span>{' '}
                      <span className="text-[10px] font-semibold text-teal-700">
                        LUHN
                      </span>
                    </p>
                    <p className="text-slate-600">
                      Order ID:{' '}
                      <span className="font-mono text-[11px] text-emerald-800">
                        4532015112830366
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-teal-700" aria-hidden="true" />
                  Processed locally in browser memory
                </span>
                <span>TXT &amp; CSV supported</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
