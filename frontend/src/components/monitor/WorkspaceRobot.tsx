import { cn } from '../../lib/cn';

export interface WorkspaceAgent {
  id: string;
  name: string;
  status: string;
  currentTask?: string | null;
  is_enabled?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  running: 'Trabajando',
  success: 'Listo',
  error: 'Error',
  idle: 'En espera',
};

export function WorkspaceRobot({ agent }: { agent: WorkspaceAgent }) {
  const working = agent.status === 'running';
  const errored = agent.status === 'error';
  const disabled = agent.is_enabled === false;

  return (
    <div
      className={cn(
        'group relative flex flex-col items-center transition-opacity duration-500',
        disabled && 'opacity-40',
      )}
    >
      {working ? (
        <span
          className="pointer-events-none absolute -inset-4 rounded-full bg-amber-400/15 blur-xl"
          aria-hidden
        />
      ) : null}

      <div className="relative">
        <svg
          viewBox="0 0 88 100"
          className={cn('h-[88px] w-[76px]', working && 'animate-monitor-bob')}
          aria-hidden
        >
          <ellipse cx="44" cy="94" rx="28" ry="5" fill="rgba(15,23,42,0.08)" />
          <rect x="18" y="72" width="52" height="6" rx="2" fill="#cbd5e1" />
          <rect x="22" y="66" width="44" height="8" rx="2" fill="#e2e8f0" />

          <g className={working ? 'origin-[44px_52px] animate-monitor-type' : undefined}>
            <rect
              x="26"
              y="38"
              width="36"
              height="30"
              rx="8"
              fill={errored ? '#fecaca' : working ? '#dbeafe' : '#f1f5f9'}
              stroke={errored ? '#f87171' : working ? '#60a5fa' : '#cbd5e1'}
              strokeWidth="2"
            />
            <rect x="30" y="44" width="28" height="14" rx="3" fill="#0f172a" opacity="0.85" />
            <circle cx="38" cy="51" r="2.5" fill={working ? '#fbbf24' : '#94a3b8'}>
              {working ? (
                <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
              ) : null}
            </circle>
            <circle cx="50" cy="51" r="2.5" fill={working ? '#fbbf24' : '#94a3b8'}>
              {working ? (
                <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
              ) : null}
            </circle>

            <rect
              x="30"
              y="22"
              width="28"
              height="18"
              rx="6"
              fill={errored ? '#fecaca' : working ? '#bfdbfe' : '#e2e8f0'}
              stroke={errored ? '#f87171' : working ? '#3b82f6' : '#94a3b8'}
              strokeWidth="2"
            />
            <line x1="44" y1="40" x2="44" y2="38" stroke="#94a3b8" strokeWidth="2" />

            <rect
              x="14"
              y="46"
              width="10"
              height="18"
              rx="4"
              fill="#cbd5e1"
              className={working ? 'origin-[19px_46px] animate-monitor-arm-l' : undefined}
            />
            <rect
              x="64"
              y="46"
              width="10"
              height="18"
              rx="4"
              fill="#cbd5e1"
              className={working ? 'origin-[69px_46px] animate-monitor-arm-r' : undefined}
            />
          </g>

          {working ? (
            <>
              <circle cx="72" cy="28" r="2" fill="#fbbf24" opacity="0.8">
                <animate attributeName="cy" values="28;18;28" dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="78" cy="34" r="1.5" fill="#60a5fa" opacity="0.7">
                <animate attributeName="cy" values="34;22;34" dur="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="1s" repeatCount="indefinite" />
              </circle>
            </>
          ) : null}
        </svg>
      </div>

      {working && agent.currentTask ? (
        <p className="mt-1 max-w-[148px] text-center text-[10px] leading-snug text-ink-muted">
          {agent.currentTask}
        </p>
      ) : null}

      <p className="mt-2 max-w-[140px] truncate text-center text-xs font-semibold text-ink">
        {agent.name}
      </p>
      <p
        className={cn(
          'text-[10px] font-medium uppercase tracking-wide',
          working && 'text-amber-600',
          errored && 'text-rose-600',
          !working && !errored && 'text-ink-muted',
        )}
      >
        {STATUS_LABEL[agent.status] ?? agent.status}
      </p>
    </div>
  );
}
