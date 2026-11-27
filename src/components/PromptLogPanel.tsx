import { Lock, Trash2 } from 'lucide-react';
import type { PromptLogEntry } from '../types/pii';
import { formatTimestamp, REDACTION_MODE_META } from '../utils/formatters';

interface PromptLogPanelProps {
  entries: PromptLogEntry[];
  onClearLog: () => void;
}

export function PromptLogPanel({ entries, onClearLog }: PromptLogPanelProps) {
  return (
    <section
      aria-labelledby="prompt-log-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 id="prompt-log-heading" className="text-base font-semibold text-slate-900">
            Prompt &amp; Processing Log
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
            Privacy-safe deterministic execution trace. Original text and sensitive values are never recorded.
          </p>
        </div>

        <button
          type="button"
          onClick={onClearLog}
          disabled={entries.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Clear Log
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          No processing events recorded yet. Load sample data, paste text, or upload a file in the Workspace.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-semibold">Timestamp</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Action</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Mode</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Rules Applied</th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-right">Detected</th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-right">Replaced</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-500">
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    <div>{entry.action}</div>
                    {entry.details && (
                      <div className="mt-0.5 text-[11px] font-normal text-slate-500">
                        {entry.details}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700">
                      {REDACTION_MODE_META[entry.redactionMode].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {entry.rulesApplied.map((rule) => (
                        <code
                          key={rule}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                        >
                          {rule}
                        </code>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-semibold">
                    {entry.entitiesDetected}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-semibold text-teal-700">
                    {entry.replacementsMade}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        entry.status === 'success'
                          ? 'bg-teal-50 text-teal-800'
                          : entry.status === 'warning'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-red-50 text-red-800'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
