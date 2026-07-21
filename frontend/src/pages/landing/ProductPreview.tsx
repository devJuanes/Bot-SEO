import { Bot, LayoutDashboard, MessageCircle, Monitor, Users, Workflow } from 'lucide-react';
import { cn } from '../../lib/cn';

export function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-200/40 via-transparent to-brand-100/30 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-border-soft bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-2 border-b border-border-soft bg-surface/80 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 text-[11px] font-medium text-ink-muted">growth.matubyte.com</span>
        </div>
        <div className="grid gap-0 lg:grid-cols-[140px_1fr]">
          <div className="hidden border-r border-border-soft bg-surface-nav p-3 lg:block">
            <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white">
              M
            </div>
            {[
              { icon: LayoutDashboard, active: false },
              { icon: Bot, active: false },
              { icon: Users, active: true },
              { icon: Workflow, active: false },
              { icon: Monitor, active: false },
              { icon: MessageCircle, active: false },
            ].map((item, i) => (
              <div
                key={i}
                className={cn(
                  'mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl',
                  item.active ? 'bg-brand-50 text-brand-600' : 'text-ink-muted/50',
                )}
              >
                <item.icon className="h-4 w-4" />
              </div>
            ))}
          </div>
          <div className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Leads</p>
                <p className="text-lg font-bold text-ink">Pipeline activo</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                3 agentes ON
              </span>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {['Nuevo', 'Contactado', 'Calificado'].map((col, i) => (
                <div key={col} className="rounded-2xl bg-surface p-2.5">
                  <p className="text-[10px] font-semibold text-ink-muted">{col}</p>
                  <div
                    className={cn(
                      'mt-2 rounded-xl px-2 py-2 text-[10px] font-medium',
                      i === 0 && 'bg-white shadow-sm ring-1 ring-border-soft',
                      i === 1 && 'bg-brand-50 text-brand-800 ring-1 ring-brand-100',
                      i === 2 && 'bg-white/60',
                    )}
                  >
                    {i === 0 ? 'Café Aurora' : i === 1 ? 'Studio MX' : '+2 más'}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-border-soft bg-[#eef2f7] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Monitor
              </p>
              <div className="flex justify-center gap-6">
                {['Lead Hunter', 'Social'].map((name, i) => (
                  <div key={name} className="text-center">
                    <div
                      className={cn(
                        'mx-auto flex h-10 w-10 items-center justify-center rounded-xl border-2',
                        i === 0
                          ? 'border-amber-300 bg-amber-50 animate-pulse'
                          : 'border-slate-200 bg-slate-50',
                      )}
                    >
                      <Bot className="h-5 w-5 text-slate-500" />
                    </div>
                    <p className="mt-1 text-[9px] font-medium text-ink">{name}</p>
                    <p className="text-[8px] text-amber-600">{i === 0 ? 'Trabajando' : 'En espera'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
