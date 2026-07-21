import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  clearSession,
  getProjectId,
  getToken,
  isUnauthorizedError,
  loadMe,
  logout as apiLogout,
  setProjectId,
  setSession,
  setUnauthorizedHandler,
} from '../api/client';
import type { MeResponse, Organization, Project } from '../types/auth';

interface AuthContextValue {
  token: string | null;
  projectId: string | null;
  me: MeResponse | null;
  loading: boolean;
  isAuthenticated: boolean;
  organizations: Organization[];
  allProjects: Array<{ org: Organization; project: Project }>;
  setActiveProject: (projectId: string, orgId: string) => void;
  login: (token: string, projectId?: string | null, orgId?: string | null) => void;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [projectId, setProjectIdState] = useState<string | null>(() => getProjectId());
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const sessionReady = useRef(false);

  const allProjects = useMemo(() => {
    if (!me) return [];
    const items: Array<{ org: Organization; project: Project }> = [];
    for (const org of me.organizations || []) {
      for (const project of me.projectsByOrg[org.id] || []) {
        items.push({ org, project });
      }
    }
    return items;
  }, [me]);

  const invalidateSession = useCallback(() => {
    clearSession();
    setToken(null);
    setMe(null);
    setProjectIdState(null);
    sessionReady.current = false;
  }, []);

  const refreshMe = useCallback(async () => {
    if (refreshInFlight.current) {
      await refreshInFlight.current;
      return;
    }

    const run = async () => {
      const showLoader = !sessionReady.current;
      if (showLoader) setLoading(true);
      try {
        const data = await loadMe();
        setMe(data);
        setToken(getToken());

        if (!getProjectId()) {
          for (const org of data.organizations || []) {
            const projects = data.projectsByOrg[org.id] || [];
            if (projects[0]) {
              setProjectId(projects[0].id);
              localStorage.setItem('growth_org_id', org.id);
              break;
            }
          }
        }
        setProjectIdState(getProjectId());
        sessionReady.current = true;
      } catch (err) {
        if (isUnauthorizedError(err)) {
          sessionReady.current = false;
          invalidateSession();
        }
        // Errores de red o servidor temporal: conservar sesión existente
      } finally {
        if (showLoader) setLoading(false);
      }
    };

    refreshInFlight.current = run();
    try {
      await refreshInFlight.current;
    } finally {
      refreshInFlight.current = null;
    }
  }, [invalidateSession]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void refreshMe();
    });
    return () => setUnauthorizedHandler(null);
  }, [refreshMe]);

  const login = useCallback((newToken: string, pid?: string | null, orgId?: string | null) => {
    setSession(newToken, pid, orgId);
    setToken(newToken);
    setProjectIdState(pid ?? getProjectId());
    sessionReady.current = true;
    setLoading(false);
    void refreshMe();
  }, [refreshMe]);

  const logout = useCallback(async () => {
    await apiLogout();
    invalidateSession();
    window.location.href = '/acceso/iniciar-sesion';
  }, [invalidateSession]);

  const setActiveProject = useCallback((id: string, orgId: string) => {
    setProjectId(id);
    localStorage.setItem('growth_org_id', orgId);
    setProjectIdState(id);
  }, []);

  const value: AuthContextValue = {
    token,
    projectId,
    me,
    loading,
    isAuthenticated: Boolean(me),
    organizations: me?.organizations ?? [],
    allProjects,
    setActiveProject,
    login,
    logout,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
