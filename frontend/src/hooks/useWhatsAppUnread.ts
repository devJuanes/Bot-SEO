import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../api/client';
import { usePolling } from './usePolling';

export function useWhatsAppUnread(enabled = true) {
  const [unread, setUnread] = useState(0);
  const [configured, setConfigured] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<{ unread: number; configured?: boolean }>(
        '/api/whatsapp/unread-count',
      );
      setUnread(data.unread ?? 0);
      setConfigured(data.configured !== false);
    } catch {
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  usePolling(() => void refresh(), 5_000, enabled, false);

  return { unread, configured, refresh };
}
