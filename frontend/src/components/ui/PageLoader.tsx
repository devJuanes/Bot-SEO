import { cn } from '../../lib/cn';

export function PageLoader({
  title = 'MatuByte',
  subtitle = 'Preparando tu espacio de trabajo…',
  className,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-screen flex-col items-center justify-center bg-surface px-6',
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative mb-8 flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-200/40" />
          <span className="absolute inset-0 animate-spin rounded-2xl border-2 border-brand-100 border-t-brand-600" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-lg shadow-brand-600/30">
            M
          </span>
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
        <div className="mt-6 flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
