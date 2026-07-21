import { useEffect, useRef, useState } from 'react';
import { Copy, MoreVertical, Power, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/cn';
import type { AutomationRule } from '../../lib/automation-flow';

export function FlowListItem({
  rule,
  selected,
  onOpen,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  rule: AutomationRule;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div
      ref={menuRef}
      className={cn(
        'group relative rounded-xl border transition',
        selected
          ? 'border-brand-300 bg-brand-50 shadow-sm'
          : 'border-border-soft bg-white hover:border-brand-200 hover:bg-surface/80 hover:shadow-sm',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full cursor-pointer px-3 py-2 pr-9 text-left text-sm transition group-hover:text-ink"
      >
        <span className="line-clamp-2 font-medium text-ink">{rule.name}</span>
        <span className="mt-1 flex items-center gap-1">
          <Badge tone={rule.is_enabled ? 'success' : 'default'}>
            {rule.is_enabled ? 'Activo' : 'Pausado'}
          </Badge>
          <span className="text-[10px] text-ink-muted">{rule.run_count} ejecuciones</span>
        </span>
      </button>

      <button
        type="button"
        aria-label="Opciones del flujo"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className={cn(
          'absolute right-1.5 top-1.5 cursor-pointer rounded-lg p-1.5 text-ink-muted transition hover:bg-white hover:text-ink',
          menuOpen && 'bg-white text-ink',
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[168px] overflow-hidden rounded-xl border border-border-soft bg-white py-1 shadow-lg">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface"
            onClick={() => {
              onOpen();
              setMenuOpen(false);
            }}
          >
            Abrir
          </button>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface"
            onClick={() => {
              onToggle();
              setMenuOpen(false);
            }}
          >
            <Power className="h-3.5 w-3.5" />
            {rule.is_enabled ? 'Pausar' : 'Activar'}
          </button>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface"
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicar
          </button>
          <hr className="my-1 border-border-soft" />
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      ) : null}
    </div>
  );
}
