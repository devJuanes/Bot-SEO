import { Bell, Filter, MessageCircle, Play, UserPlus, Zap } from 'lucide-react';
import {
  ACTION_OPTIONS,
  FLOW_TEMPLATES,
  TRIGGER_OPTIONS,
  type AutomationFlow,
} from '../../lib/automation-flow';
import { cn } from '../../lib/cn';

const TRIGGER_ICONS: Record<string, typeof Zap> = {
  'lead.created': UserPlus,
  'lead.status_changed': Zap,
  'agent.run.completed': Play,
  'agent.run.started': Play,
  'whatsapp.message_received': MessageCircle,
};

export function FlowPalette({
  onPickTrigger,
  onAddFilter,
  onAddAction,
  onApplyTemplate,
}: {
  onPickTrigger: (triggerId: string) => void;
  onAddFilter: () => void;
  onAddAction: (actionId?: string) => void;
  onApplyTemplate: (flow: AutomationFlow, name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Disparadores
        </p>
        <div className="flex flex-col gap-1.5">
          {TRIGGER_OPTIONS.map((t) => {
            const Icon = TRIGGER_ICONS[t.id] ?? Zap;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPickTrigger(t.id)}
                className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50/80 px-2.5 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50"
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-700" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-violet-900">{t.label}</span>
                  <span className="block text-[10px] leading-snug text-violet-700/80">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Lógica y acciones
        </p>
        <button
          type="button"
          onClick={onAddFilter}
          className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-left text-xs font-medium text-amber-900 transition hover:bg-amber-50"
        >
          <Filter className="h-3.5 w-3.5" />
          Añadir filtro
        </button>
        <div className="flex flex-col gap-1.5">
          {ACTION_OPTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onAddAction(a.id)}
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 text-left text-xs font-medium text-emerald-900 transition hover:bg-emerald-50"
            >
              <Bell className="h-3.5 w-3.5 shrink-0" />
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Plantillas rápidas
        </p>
        <div className="flex flex-col gap-1.5">
          {FLOW_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onApplyTemplate(tpl.flow, tpl.name)}
              className={cn(
                'rounded-xl border border-border-soft bg-surface px-2.5 py-2 text-left text-xs transition hover:border-brand-200 hover:bg-brand-50/50',
              )}
            >
              <span className="font-medium text-ink">{tpl.name}</span>
              <span className="mt-0.5 block text-[10px] text-ink-muted">{tpl.desc}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
