import type { DetectionStats } from '../types/pii';

interface SummaryStatsProps {
  stats: DetectionStats;
}

export function SummaryStats({ stats }: SummaryStatsProps) {
  const cards: { label: string; value: number; tone?: 'default' | 'accent' | 'warning' | 'teal' }[] = [
    { label: 'Total Detected', value: stats.totalDetected, tone: 'accent' },
    { label: 'Emails', value: stats.emailCount },
    { label: 'Phones', value: stats.phoneCount },
    { label: 'IPv4 Addresses', value: stats.ipCount },
    { label: 'PAN', value: stats.panCount },
    { label: 'Aadhaar-Format', value: stats.aadhaarCount },
    { label: 'Card Candidates', value: stats.creditCardCount },
    {
      label: 'Needs Review',
      value: stats.reviewRequiredCount,
      tone: stats.reviewRequiredCount > 0 ? 'warning' : 'default',
    },
    { label: 'Replacements', value: stats.totalReplacements, tone: 'teal' },
  ];

  return (
    <section aria-label="Detection summary" className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-9">
      {cards.map((card) => {
        let valueClass = 'text-slate-900';
        let borderClass = 'border-slate-200 bg-white';

        if (card.tone === 'accent') {
          valueClass = 'text-blue-700';
          borderClass = 'border-blue-200 bg-blue-50/40';
        } else if (card.tone === 'teal') {
          valueClass = 'text-teal-700';
          borderClass = 'border-teal-200 bg-teal-50/50';
        } else if (card.tone === 'warning') {
          valueClass = 'text-amber-700';
          borderClass = 'border-amber-200 bg-amber-50/60';
        }

        return (
          <div
            key={card.label}
            className={`rounded-lg border px-3 py-2.5 ${borderClass}`}
          >
            <div className="text-[11px] font-medium tracking-wide text-slate-600 uppercase">
              {card.label}
            </div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
              {card.value}
            </div>
          </div>
        );
      })}
    </section>
  );
}
