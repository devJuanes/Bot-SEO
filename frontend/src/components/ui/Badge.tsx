import { cn } from '../../lib/cn';

const tones: Record<string, string> = {
  default: 'bg-surface-nav text-ink-muted',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-brand-50 text-brand-700',
  brand: 'bg-brand-50 text-brand-600',
  info: 'bg-sky-50 text-sky-700',
  trend: 'bg-brand-600 text-white',
  trendDown: 'bg-surface-nav text-ink-muted',
};

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TrendPill({
  value,
  positive,
}: {
  value: string;
  positive?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        positive ? 'bg-brand-600 text-white' : 'bg-surface-nav text-ink-muted',
      )}
    >
      {value}
    </span>
  );
}
