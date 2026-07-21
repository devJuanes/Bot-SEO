import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { renameProject } from '../../api/client';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/cn';

export function useProjectRename(projectId: string, name: string) {
  const { refreshMe } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function startEdit(e?: React.MouseEvent) {
    e?.stopPropagation();
    setValue(name);
    setError('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setValue(name);
    setError('');
  }

  async function save() {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setError('Mínimo 2 caracteres');
      return;
    }
    if (trimmed === name) {
      cancelEdit();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await renameProject(projectId, trimmed);
      await refreshMe();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo renombrar');
    } finally {
      setSaving(false);
    }
  }

  return { editing, value, setValue, saving, error, startEdit, cancelEdit, save };
}

export function ProjectRenameForm({
  value,
  onChange,
  saving,
  error,
  onSave,
  onCancel,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  saving: boolean;
  error: string;
  onSave: () => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-2', compact ? 'p-2' : 'p-3')}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={compact ? 'h-8 text-xs' : 'h-9 text-sm'}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') void onSave();
          if (e.key === 'Escape') onCancel();
        }}
      />
      {error ? <p className="text-xs text-brand-700">{error}</p> : null}
      <div className="flex gap-1.5">
        <Button size="sm" loading={saving} className="h-7 flex-1" onClick={() => void onSave()}>
          <Check className="h-3.5 w-3.5" />
          Guardar
        </Button>
        <Button size="sm" variant="secondary" className="h-7 px-2" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ProjectRenameButton({
  onClick,
  compact,
}: {
  onClick: (e: React.MouseEvent) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      title="Renombrar proyecto"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-lg text-ink-muted transition hover:bg-white hover:text-brand-600',
        compact ? 'p-1.5' : 'p-2',
      )}
    >
      <Pencil className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </button>
  );
}
