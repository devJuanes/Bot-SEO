import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { projectApi, getProjectId } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export interface SetupStatus {
  brandConfigured: boolean;
  whatsappConfigured: boolean;
  facebookConfigured: boolean;
  llmConfigured: boolean;
  contentEnabled: boolean;
  brandProfile?: unknown;
  huntSources?: Record<string, unknown>;
  project?: {
    id: string;
    name: string;
    brand_name: string | null;
    content_enabled: boolean;
    brand_configured: boolean;
  };
}

interface SetupContextValue {
  status: SetupStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SetupContext = createContext<SetupContextValue | null>(null);

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, projectId } = useAuth();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  useEffect(() => {
    hasLoaded.current = false;
    setStatus(null);
    setLoading(true);
  }, [projectId]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !getProjectId()) {
      setStatus(null);
      setLoading(false);
      return;
    }
    const isFirstLoad = !hasLoaded.current;
    if (isFirstLoad) setLoading(true);
    try {
      const res = await projectApi('/setup/status');
      if (res.ok) {
        setStatus((await res.json()) as SetupStatus);
        hasLoaded.current = true;
      }
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh, isAuthenticated, projectId]);

  return (
    <SetupContext.Provider value={{ status, loading, refresh }}>
      {children}
    </SetupContext.Provider>
  );
}

export function useSetup() {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error('useSetup must be used within SetupProvider');
  return ctx;
}
