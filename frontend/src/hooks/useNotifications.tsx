import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { projectApi, getProjectId } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { usePolling } from './usePolling';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsContextValue {
  items: AppNotification[];
  unread: number;
  toast: AppNotification | null;
  dismissToast: () => void;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function playPing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.stop(ctx.currentTime + 0.26);
  } catch {
    /* ignore */
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, projectId } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !getProjectId()) {
      setItems([]);
      setUnread(0);
      return;
    }
    try {
      const res = await projectApi('/notifications');
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: AppNotification[];
        unread: number;
      };
      const list = data.notifications || [];

      if (primed.current) {
        for (const n of list) {
          if (!n.is_read && !seenRef.current.has(n.id)) {
            setToast(n);
            playPing();
            break;
          }
        }
      }
      for (const n of list) seenRef.current.add(n.id);
      primed.current = true;
      setItems(list);
      setUnread(data.unread ?? list.filter((x) => !x.is_read).length);
    } catch {
      /* ignore */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      primed.current = false;
      seenRef.current = new Set();
      setItems([]);
      setUnread(0);
      return;
    }
    void refresh();
  }, [refresh, isAuthenticated, projectId]);

  usePolling(refresh, 30_000, isAuthenticated && Boolean(getProjectId()), false);

  const markRead = useCallback(async (id: string) => {
    await projectApi(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: '{}' });
    await refresh();
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    await projectApi('/notifications/read-all', { method: 'POST', body: '{}' });
    await refresh();
  }, [refresh]);

  return (
    <NotificationsContext.Provider
      value={{
        items,
        unread,
        toast,
        dismissToast: () => setToast(null),
        refresh,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
