import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ConfiguredSecretSectionProps {
  configured: boolean;
  title: string;
  description: string;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ConfiguredSecretSection({
  configured,
  title,
  description,
  editing,
  onStartEdit,
  onCancelEdit,
  children,
  className,
}: ConfiguredSecretSectionProps) {
  if (configured && !editing) {
    return (
      <div
        className={cn(
          'rounded-xl border border-emerald-200 bg-emerald-50 p-4',
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="min-w-0">
            <h3 className="font-medium text-emerald-900">{title}</h3>
            <p className="mt-1 text-sm text-emerald-700">{description}</p>
            <button
              type="button"
              onClick={onStartEdit}
              className="mt-2 text-sm font-medium text-emerald-800 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-950"
            >
              Si quieres editarlo, haz clic aquí.
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {configured && editing && onCancelEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Cancelar edición
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
