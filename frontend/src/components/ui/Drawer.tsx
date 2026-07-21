import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

const ANIM_MS = 300;

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerExtra,
  children,
  side = 'left',
  width = 'w-[min(380px,92vw)]',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  side?: 'left' | 'right';
  width?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const slideClass =
    side === 'right'
      ? visible
        ? 'translate-x-0'
        : 'translate-x-full'
      : visible
        ? 'translate-x-0'
        : '-translate-x-full';

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Cerrar panel"
        className={cn(
          'absolute inset-0 bg-ink/30 backdrop-blur-[1px] transition-opacity duration-300 ease-out',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute top-0 flex h-full flex-col bg-white shadow-2xl',
          'transition-transform duration-300 ease-out will-change-transform',
          width,
          side === 'right' ? 'right-0' : 'left-0',
          slideClass,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-soft px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p>
            ) : null}
            {headerExtra ? <div className="mt-2 flex flex-wrap gap-1">{headerExtra}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
