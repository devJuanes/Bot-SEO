import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

export function Input({
  className,
  autoComplete,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const resolvedAutoComplete =
    autoComplete ?? (type === 'password' ? 'new-password' : 'off');

  return (
    <input
      type={type}
      autoComplete={resolvedAutoComplete}
      spellCheck={false}
      className={cn(
        'h-10 w-full rounded-2xl border border-border-soft bg-white px-4 text-sm text-ink shadow-sm transition placeholder:text-ink-muted focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100',
        className,
      )}
      {...props}
    />
  );
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, autoComplete = 'off', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      autoComplete={autoComplete}
      spellCheck={false}
      className={cn(
        'min-h-[100px] w-full rounded-2xl border border-border-soft bg-white px-4 py-3 text-sm text-ink shadow-sm transition placeholder:text-ink-muted focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100',
        className,
      )}
      {...props}
    />
  );
});

export function Select({
  className,
  children,
  autoComplete = 'off',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      autoComplete={autoComplete}
      className={cn(
        'h-10 w-full rounded-2xl border border-border-soft bg-white px-4 text-sm text-ink shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('mb-1.5 block text-sm font-medium text-ink', className)} {...props}>
      {children}
    </label>
  );
}

export function Field({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('flex flex-col', className)}>{children}</div>;
}
