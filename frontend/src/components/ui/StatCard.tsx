import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export function StatCard({
  label,
  value,
  subValue,
  hint,
  icon: Icon,
  dark,
  compact,
  className,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  hint?: string;
  icon?: LucideIcon;
  dark?: boolean;
  /** Texto más pequeño para fechas u otros valores largos */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[7.5rem] flex-col rounded-2xl border border-border-soft/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        dark && 'border-transparent bg-ink text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)]',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              dark ? 'bg-white/10 text-white' : 'bg-brand-50 text-brand-600',
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        ) : (
          <div
            className={cn(
              'h-9 w-9 shrink-0 rounded-xl',
              dark ? 'bg-white/5' : 'bg-surface',
            )}
          />
        )}
        <p
          className={cn(
            'text-[11px] font-semibold uppercase leading-snug tracking-wide',
            dark ? 'text-white/65' : 'text-ink-muted',
          )}
        >
          {label}
        </p>
      </div>

      <div className="mt-auto pt-3">
        <p
          className={cn(
            'font-bold tracking-tight',
            compact ? 'text-lg leading-snug' : 'text-2xl leading-none',
            dark ? 'text-white' : 'text-ink',
          )}
        >
          {value}
        </p>
        {subValue ? (
          <p className={cn('mt-1 text-sm font-medium', dark ? 'text-white/75' : 'text-ink-muted')}>
            {subValue}
          </p>
        ) : null}
        {hint ? (
          <p className={cn('mt-1.5 text-xs', dark ? 'text-white/55' : 'text-ink-muted')}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
