import type { MeResponse } from '../types/auth';

const TOKEN_KEY = 'growth_token';
const PROJECT_KEY = 'growth_project_id';
const ORG_KEY = 'growth_org_id';

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function isUnauthorizedError(err: unknown): boolean {
  return err instanceof UnauthorizedError || (err instanceof Error && err.message === 'Unauthorized');
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getProjectId(): string | null {
  return localStorage.getItem(PROJECT_KEY);
}

export function getOrgId(): string | null {
  return localStorage.getItem(ORG_KEY);
}

export function setSession(token: string, projectId?: string | null, orgId?: string | null): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (projectId) localStorage.setItem(PROJECT_KEY, projectId);
  if (orgId) localStorage.setItem(ORG_KEY, orgId);
}

export function setProjectId(id: string): void {
  localStorage.setItem(PROJECT_KEY, id);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROJECT_KEY);
  localStorage.removeItem(ORG_KEY);
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const projectId = getProjectId();
  if (projectId) headers.set('X-Project-Id', projectId);
  return headers;
}

function connectionErrorMessage(res: Response): string {
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return 'El servidor API no está disponible. Ejecuta npm run dev en la raíz del proyecto.';
  }
  return res.statusText || `Error ${res.status}`;
}

/** Parse JSON safely — avoids "Unexpected end of JSON input" on empty proxy/backend failures. */
export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(connectionErrorMessage(res));
    }
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok ? 'Respuesta inválida del servidor' : connectionErrorMessage(res),
    );
  }
}

export async function api(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const projectId = getProjectId();
  if (projectId) headers.set('X-Project-Id', projectId);

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers, credentials: 'include' });
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo npm run dev?');
  }

  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    unauthorizedHandler?.();
    throw new UnauthorizedError();
  }
  return res;
}

export async function loadMe(): Promise<MeResponse> {
  let res: Response;
  try {
    res = await fetch('/api/auth/me', {
      headers: authHeaders(),
      credentials: 'include',
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    throw new Error(connectionErrorMessage(res));
  }
  return parseJsonResponse<MeResponse>(res);
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: '{}',
    });
  } catch {
    /* ignore */
  }
  clearSession();
}

export async function ensureProjectReady(): Promise<void> {
  if (getProjectId()) return;
  const me = await loadMe();
  for (const org of me.organizations || []) {
    const projects = me.projectsByOrg[org.id] || [];
    if (projects[0]) {
      setProjectId(projects[0].id);
      localStorage.setItem(ORG_KEY, org.id);
      return;
    }
  }
}

export async function projectApi(path: string, options: RequestInit = {}): Promise<Response> {
  let pid = getProjectId();
  if (!pid) {
    try {
      await ensureProjectReady();
    } catch {
      // keep going; api may still work for some routes
    }
    pid = getProjectId();
  }
  if (!pid) {
    return new Response(JSON.stringify({ error: 'No hay proyecto activo' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return api(`/api/projects/${pid}${path}`, options);
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await api(path, {
    ...options,
    headers: isForm
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await parseJsonResponse<T & { error?: string }>(res);
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err.error || connectionErrorMessage(res));
  }
  return data as T;
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  await apiJson(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: name.trim() }),
  });
}
