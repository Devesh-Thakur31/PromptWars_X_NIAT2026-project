import { FileText, Lock, ShieldCheck, Info } from 'lucide-react';

export type ActiveTab = 'workspace' | 'prompt-log' | 'privacy';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  logCount: number;
}

export function Header({ activeTab, onTabChange, logCount }: HeaderProps) {
  const navItems: { id: ActiveTab; label: string; icon: typeof FileText; badge?: number }[] = [
    { id: 'workspace', label: 'Workspace', icon: FileText },
    { id: 'prompt-log', label: 'Prompt Log', icon: Lock, badge: logCount },
    { id: 'privacy', label: 'Privacy & About', icon: Info },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/90 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow-2xs">
              <ShieldCheck className="h-5 w-5 text-teal-300" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-editorial text-xl font-normal tracking-tight text-slate-900">
                PRIVY
              </h1>
              <p className="text-xs text-slate-500">
                Client-Side PII Detection &amp; Redaction Engine
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50/80 px-2.5 py-1 text-xs font-medium text-teal-800 lg:hidden">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            100% Local
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Primary navigation" className="flex items-center gap-1 rounded-lg border border-stone-200/80 bg-[#FAF8F3] p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                  {typeof item.badge === 'number' && (
                    <span className="ml-0.5 rounded-full bg-stone-200/80 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <span className="hidden items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50/80 px-3 py-1 text-xs font-medium text-teal-800 lg:inline-flex">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            In-Browser Only · Zero Network Calls
          </span>
        </div>
      </div>
    </header>
  );
}
