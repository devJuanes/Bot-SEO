import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Search, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { Button } from '../components/ui/Button';
import { ProjectSwitcherDropdown } from '../components/projects/ProjectSwitcherDropdown';
import { cn } from '../lib/cn';

export function AppHeader() {
  const { logout } = useAuth();
  const { items, unread, toast, dismissToast, markRead, markAllRead } = useNotifications();
  const [openBell, setOpenBell] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!bellRef.current?.contains(e.target as Node)) setOpenBell(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dismissToast(), 6000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-4 border-b border-border-soft bg-white px-5">
      <ProjectSwitcherDropdown />

      <div className="mx-auto hidden w-full max-w-md md:block">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            placeholder="Buscar leads, campañas, contenido…"
            className="h-10 w-full rounded-full border border-border-soft bg-surface pl-11 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setOpenBell((v) => !v)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border-soft bg-white text-ink-muted transition hover:bg-surface"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-0.5 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {openBell && (
            <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border-soft bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
                <span className="text-sm font-semibold">Notificaciones</span>
                {unread > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-600"
                    onClick={() => void markAllRead()}
                  >
                    Marcar todas
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-ink-muted">No hay notificaciones</p>
                ) : (
                  items.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={cn(
                        'block w-full border-b border-border-soft px-4 py-3 text-left hover:bg-surface',
                        !n.is_read && 'bg-brand-50/40',
                      )}
                      onClick={() => {
                        void markRead(n.id);
                        if (n.link) window.location.href = n.link;
                        setOpenBell(false);
                      }}
                    >
                      <div className="text-sm font-medium text-ink">{n.title}</div>
                      {n.body && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{n.body}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Link
          to="/settings/project"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft bg-white text-ink-muted transition hover:bg-surface"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <Button
          size="sm"
          variant="secondary"
          loading={loggingOut}
          onClick={() => {
            setLoggingOut(true);
            void logout();
          }}
          className="hidden sm:inline-flex"
        >
          <LogOut className="h-3.5 w-3.5" />
          Salir
        </Button>
      </div>

      {toast && (
        <div className="absolute right-5 top-16 z-50 w-80 animate-[fadeIn_0.2s_ease] rounded-2xl border border-border-soft bg-white p-4 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-ink">{toast.title}</div>
              {toast.body && <p className="mt-1 text-xs text-ink-muted">{toast.body}</p>}
            </div>
            <button type="button" className="text-xs text-ink-muted" onClick={dismissToast}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
