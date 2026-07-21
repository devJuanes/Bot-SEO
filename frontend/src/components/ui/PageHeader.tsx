import { LucideIcon } from 'lucide-react';

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  illustration,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  illustration?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-slate-200/80 bg-white">
      <div className="illustration-blob -left-20 -top-20 h-56 w-56 bg-brand-300" />
      <div className="illustration-blob right-10 top-0 h-40 w-40 bg-sky-300" />
      <div className="relative mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-4 px-6 py-6 lg:px-8">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
              <Icon className="h-6 w-6" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        {illustration}
      </div>
    </div>
  );
}
