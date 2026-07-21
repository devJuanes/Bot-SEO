import { cn } from '../../lib/cn';

export function Card({
  className,
  children,
  variant = 'light',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'light' | 'dark' | 'flat' }) {
  return (
    <div
      className={cn(
        variant === 'dark' && 'soft-card-dark',
        variant === 'light' && 'soft-card',
        variant === 'flat' && 'rounded-3xl bg-surface-nav',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-5 py-4', className)}>
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('p-5', className)}>{children}</div>;
}
