import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border-soft bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-brand-600 shadow-sm">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({
  label = 'Cargando…',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-8' : 'gap-4 py-16',
      )}
    >
      <div className="relative flex h-10 w-10 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
        <span className="relative h-3 w-3 rounded-full bg-brand-600" />
      </div>
      <p className="text-sm font-medium text-ink">{label}</p>
      {!compact && (
        <p className="max-w-xs text-xs text-ink-muted">Esto suele tardar solo un momento.</p>
      )}
    </div>
  );
}

export function TableShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('soft-card overflow-hidden', className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTable({
  columns,
  children,
}: {
  columns: Array<{ key: string; label: string; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="border-b border-border-soft bg-surface text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <tr>
          {columns.map((col) => (
            <th key={col.key} className={cn('px-5 py-3.5', col.className)}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border-soft bg-white">{children}</tbody>
    </table>
  );
}

export function TableRow({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn('transition hover:bg-surface/80', onClick && 'cursor-pointer', className)}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td className={cn('px-5 py-3.5 align-middle text-ink-muted', className)} title={title}>
      {children}
    </td>
  );
}
