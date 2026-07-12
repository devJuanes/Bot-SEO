import { env } from '../config/env.js';
import { withRetry } from '../utils/retry.js';

/**
 * Wrapper ligero sobre la Meta Graph API para Pages — patrón idéntico a
 * src/whatsapp/client.ts. Documentación oficial:
 * https://developers.facebook.com/docs/pages-api/posts
 */

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${env.FB_GRAPH_VERSION}/${path}`;
}

interface PageCredentials {
  token: string;
  pageId: string;
}

function requireCredentials(): PageCredentials {
  if (!env.FB_PAGE_ACCESS_TOKEN || !env.FB_PAGE_ID) {
    throw new Error(
      'Facebook Publisher no configurado. Define FB_PAGE_ID y FB_PAGE_ACCESS_TOKEN en .env, o usa FB_DRY_RUN=true para simular.',
    );
  }
  return {
    token: env.FB_PAGE_ACCESS_TOKEN,
    pageId: env.FB_PAGE_ID,
  };
}

async function callGraphApi(
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const { token } = requireCredentials();
  const response = await fetch(graphUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } } | null)?.error?.message ??
      response.statusText;
    throw new Error(`Facebook API error (${response.status}): ${message}`);
  }
  return payload;
}

export interface PublishResult {
  fbPostId: string | null;
  fbPermalinkUrl: string | null;
  raw: unknown;
}

/**
 * POST /{page-id}/feed — post de texto plano en el muro de la página.
 * Devuelve { id, permalink_url } según docs de Meta.
 */
export async function publishFeedPost(message: string): Promise<PublishResult> {
  const { pageId } = requireCredentials();
  const payload = await callGraphApi(`${pageId}/feed`, {
    message,
  });
  const obj = payload as { id?: string; permalink_url?: string } | null;
  return {
    fbPostId: obj?.id ?? null,
    fbPermalinkUrl: obj?.permalink_url ?? null,
    raw: payload,
  };
}

/**
 * POST /{page-id}/photos — foto con caption desde URL pública.
 * Meta descarga la imagen por nosotros; debe ser JPEG/PNG accesible sin auth.
 */
export async function publishPhotoPost(
  imageUrl: string,
  caption: string,
): Promise<PublishResult> {
  const { pageId } = requireCredentials();
  const payload = await callGraphApi(`${pageId}/photos`, {
    caption,
    url: imageUrl,
    published: true,
  });
  const obj = payload as { id?: string; permalink_url?: string } | null;
  return {
    fbPostId: obj?.id ?? null,
    fbPermalinkUrl: obj?.permalink_url ?? null,
    raw: payload,
  };
}

/**
 * Modo dry-run: simula la respuesta de Meta para que el flujo completo
 * (INSERT → publish → UPDATE) funcione sin página real. Devuelve IDs fake.
 */
export async function publishDryRun(
  variant: 'feed' | 'photos',
  payload: { message: string; imageUrl?: string },
): Promise<PublishResult> {
  const fakeId = `fake_${variant}_${Date.now().toString(36)}`;
  return {
    fbPostId: fakeId,
    fbPermalinkUrl: `https://facebook.com/dry-run/${fakeId}`,
    raw: { dryRun: true, payload },
  };
}

/** Wrapper que aplica withRetry (para 5xx transitorios). Para 4xx propaga el error. */
export async function publishWithRetry(
  publish: () => Promise<PublishResult>,
  label = 'fb-publish',
): Promise<PublishResult> {
  return withRetry(publish, { attempts: 2, delayMs: 1200, label });
}

export function isFacebookConfigured(): boolean {
  return Boolean(env.FB_PAGE_ACCESS_TOKEN && env.FB_PAGE_ID);
}

export function isFacebookDryRun(): boolean {
  // Si está explícitamente true, dry-run. Si no hay token configurado, también dry-run.
  if (env.FB_DRY_RUN === true) return true;
  if (!isFacebookConfigured()) return true;
  return false;
}
