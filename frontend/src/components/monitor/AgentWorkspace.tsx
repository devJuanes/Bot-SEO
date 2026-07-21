import { useMemo } from 'react';
import { WorkspaceRobot, type WorkspaceAgent } from './WorkspaceRobot';
import { cn } from '../../lib/cn';
import type { RuntimeLog } from '../../hooks/useRuntimeEvents';

function floorCols(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

export function AgentWorkspace({
  agents,
  logs,
  connected,
}: {
  agents: WorkspaceAgent[];
  logs: RuntimeLog[];
  connected: boolean;
}) {
  const sorted = useMemo(() => {
    const order = { running: 0, error: 1, success: 2, idle: 3 };
    return [...agents].sort((a, b) => {
      const ao = order[a.status as keyof typeof order] ?? 9;
      const bo = order[b.status as keyof typeof order] ?? 9;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
  }, [agents]);

  const cols = floorCols(sorted.length);
  const running = sorted.filter((a) => a.status === 'running').length;
  const latestLog = logs[0];

  return (
    <div className="relative flex min-h-[min(72vh,640px)] flex-col overflow-hidden rounded-3xl border border-border-soft bg-[#eef2f7]">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
        aria-hidden
      />

      <div className="relative flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span
            className={cn(
              'inline-flex h-2 w-2 rounded-full',
              connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-400',
            )}
          />
          {connected ? 'Monitor en vivo' : 'Reconectando…'}
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            {running > 0
              ? `${running} agente${running === 1 ? '' : 's'} trabajando`
              : 'Todos en espera'}
          </span>
        </div>
        <p className="text-[11px] text-ink-muted">
          {sorted.length} puesto{sorted.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-4 pt-2">
        {sorted.length === 0 ? (
          <div className="text-center">
            <p className="text-sm font-medium text-ink-muted">El espacio de trabajo está vacío</p>
            <p className="mt-1 text-xs text-ink-muted/80">
              Activa agentes en la sección Agentes para verlos aquí.
            </p>
          </div>
        ) : (
          <div
            className="grid gap-x-10 gap-y-12"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(100px, 140px))`,
            }}
          >
            {sorted.map((agent) => (
              <WorkspaceRobot key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>

      <div className="relative border-t border-slate-300/50 bg-white/40 px-5 py-2.5 backdrop-blur-sm">
        <p className="truncate font-mono text-[11px] text-ink-muted">
          {latestLog ? (
            <>
              <span className="text-ink/50">
                {latestLog.ts ? new Date(latestLog.ts).toLocaleTimeString() : '—'}
              </span>{' '}
              <span className="text-brand-600">{latestLog.agentId ?? 'sistema'}</span>{' '}
              {latestLog.message}
            </>
          ) : (
            'Esperando actividad de los agentes…'
          )}
        </p>
      </div>
    </div>
  );
}
