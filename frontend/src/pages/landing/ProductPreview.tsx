import { Bot, LayoutDashboard, MessageCircle, Monitor, Users, Workflow } from 'lucide-react';
import { cn } from '../../lib/cn';

export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      {/* Atmosphere blobs */}
      <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-brand-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-36 w-36 rounded-full bg-brand-600/20 blur-3xl" />

      {/* Floating status chip */}
      <div className="landing-float absolute -left-2 top-8 z-20 hidden rounded-2xl border border-border-soft bg-white/95 px-3.5 py-2.5 shadow-lg shadow-brand-600/10 sm:block lg:-left-6">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Agentes</p>
        <p className="mt-0.5 text-sm font-bold text-ink">
          <span className="text-brand-600">3</span> activos ahora
        </p>
      </div>

      {/* Floating WhatsApp chip */}
      <div className="landing-float-slow absolute -right-1 bottom-16 z-20 hidden max-w-[180px] rounded-2xl border border-border-soft bg-white/95 px-3.5 py-2.5 shadow-lg shadow-brand-600/10 sm:block lg:-right-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <MessageCircle className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold text-ink">WhatsApp</p>
            <p className="text-[10px] text-ink-muted">Nuevo lead respondió</p>
          </div>
        </div>
      </div>

      {/* Main product plane — edge visual, not a marketing card stack */}
      <div className="relative overflow-hidden border border-border-soft bg-white shadow-[0_32px_90px_rgba(225,29,72,0.12)]">
        <div className="flex items-center gap-2 border-b border-border-soft bg-surface/90 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 text-[11px] font-medium text-ink-muted">growth.matubyte.com</span>
        </div>

        <div className="grid gap-0 lg:grid-cols-[132px_1fr]">
          <div className="hidden border-r border-border-soft bg-surface-nav p-3 lg:block">
            <img src="/logo.png" alt="" className="mb-4 h-8 w-8 object-contain" />
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
                  item.active ? 'bg-brand-50 text-brand-600' : 'text-ink-muted/45',
                )}
              >
                <item.icon className="h-4 w-4" />
              </div>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-ink-muted">Leads</p>
                <p className="font-display text-lg font-bold tracking-tight text-ink">Pipeline activo</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                Lead Hunter ON
              </span>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              {['Nuevo', 'Contactado', 'Calificado'].map((col, i) => (
                <div key={col} className="bg-surface p-2.5">
                  <p className="text-[10px] font-semibold text-ink-muted">{col}</p>
                  <div
                    className={cn(
                      'mt-2 px-2 py-2 text-[10px] font-medium',
                      i === 0 && 'bg-white shadow-sm ring-1 ring-border-soft',
                      i === 1 && 'bg-brand-50 text-brand-800 ring-1 ring-brand-100',
                      i === 2 && 'bg-white/70 text-ink-muted',
                    )}
                  >
                    {i === 0 ? 'Café Aurora' : i === 1 ? 'Studio MX' : '+2 más'}
                  </div>
                </div>
              ))}
            </div>

            <div className="border border-border-soft bg-gradient-to-br from-brand-50/80 to-surface p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Monitor en vivo
              </p>
              <div className="flex justify-center gap-8">
                {['Lead Hunter', 'Social'].map((name, i) => (
                  <div key={name} className="text-center">
                    <div
                      className={cn(
                        'mx-auto flex h-10 w-10 items-center justify-center border-2',
                        i === 0
                          ? 'border-brand-300 bg-brand-50 animate-pulse'
                          : 'border-border-soft bg-white',
                      )}
                    >
                      <Bot className={cn('h-5 w-5', i === 0 ? 'text-brand-600' : 'text-ink-muted')} />
                    </div>
                    <p className="mt-1 text-[9px] font-medium text-ink">{name}</p>
                    <p className={cn('text-[8px]', i === 0 ? 'text-brand-600' : 'text-ink-muted')}>
                      {i === 0 ? 'Trabajando' : 'En espera'}
                    </p>
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
