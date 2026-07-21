import { Check } from 'lucide-react';
import { Badge } from '../ui/Badge';
import {
  ProjectRenameButton,
  ProjectRenameForm,
  useProjectRename,
} from './ProjectRenameControls';
import { cn } from '../../lib/cn';

export function ProjectListRow({
  projectId,
  name,
  type,
  active,
  compact,
  onSelect,
}: {
  projectId: string;
  name: string;
  type?: string;
  active: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  const rename = useProjectRename(projectId, name);

  if (rename.editing) {
    return (
      <div
        className={cn(
          'rounded-xl border',
          active ? 'border-brand-200 bg-brand-50' : 'border-border-soft bg-white',
        )}
      >
        <ProjectRenameForm
          compact={compact}
          value={rename.value}
          onChange={rename.setValue}
          saving={rename.saving}
          error={rename.error}
          onSave={() => void rename.save()}
          onCancel={rename.cancelEdit}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-xl transition',
        compact
          ? active
            ? 'bg-brand-50'
            : 'hover:bg-surface'
          : cn(
              'border',
              active
                ? 'border-brand-200 bg-brand-50'
                : 'border-border-soft bg-white hover:border-brand-100',
            ),
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center justify-between gap-3 text-left',
          compact ? 'px-3 py-2.5 text-sm' : 'px-4 py-3',
        )}
      >
        <div className="min-w-0">
          <p className={cn('truncate font-medium text-ink', compact && 'font-normal')}>{name}</p>
          {type && !compact ? <p className="text-xs text-ink-muted">{type}</p> : null}
        </div>
        {active ? (
          compact ? (
            <Check className="h-4 w-4 shrink-0 text-brand-600" />
          ) : (
            <Badge tone="brand">
              <Check className="mr-1 inline h-3 w-3" />
              Activo
            </Badge>
          )
        ) : compact ? null : (
          <span className="text-xs font-medium text-brand-600">Usar</span>
        )}
      </button>
      <ProjectRenameButton onClick={rename.startEdit} compact={compact} />
    </div>
  );
}
