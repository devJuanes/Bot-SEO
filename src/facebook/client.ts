import { config as loadDotenv } from 'dotenv';
import { withRetry } from '../utils/retry.js';

/**
 * Wrapper ligero sobre la Meta Graph API para Pages.
 * Relee `.env` en cada check para que FB_DRY_RUN=false aplique sin ambigüedad
 * tras guardar el archivo (tsx watch no siempre reinicia por .env).
 * https://developers.facebook.com/docs/pages-api/posts
 */

function refreshEnvFromDisk(): void {
  loadDotenv({ override: true });
}

function graphVersion(): string {
  refreshEnvFromDisk();
  return process.env.FB_GRAPH_VERSION?.trim() || 'v21.0';
}

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${graphVersion()}/${path}`;
}

interface PageCredentials {
  token: string;
  pageId: string;
}

function requireCredentials(): PageCredentials {
  refreshEnvFromDisk();
  const token = process.env.FB_PAGE_ACCESS_TOKEN?.trim();
  const pageId = process.env.FB_PAGE_ID?.trim();
  if (!token || !pageId) {
    throw new Error(
      'Facebook Publisher no configurado. Define FB_PAGE_ID y FB_PAGE_ACCESS_TOKEN en .env, o usa FB_DRY_RUN=true para simular.',
    );
  }
  return { token, pageId };
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
    const err = (payload as {
      error?: { message?: string; code?: number; error_subcode?: number; type?: string };
    } | null)?.error;
    const message = err?.message ?? response.statusText;
    const permHint =
      response.status === 403 || err?.code === 200
        ? ' — Regenera el Page token en Graph API Explorer con pages_manage_posts + pages_show_list + pages_read_engagement, elige la Página MatuByte, y usa el access_token de me/accounts (no el de usuario).'
        : '';
    throw new Error(
      `Facebook API error (${response.status}): ${message}${permHint}`,
    );
  }
  return payload;
}

export interface PublishResult {
  fbPostId: string | null;
  fbPermalinkUrl: string | null;
  raw: unknown;
}

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
 * POST /{page-id}/videos — video desde URL pública (Pexels MP4).
 * https://developers.facebook.com/docs/graph-api/reference/page/videos/
 */
export async function publishVideoPost(
  videoUrl: string,
  description: string,
): Promise<PublishResult> {
  const { pageId } = requireCredentials();
  const payload = await callGraphApi(`${pageId}/videos`, {
    file_url: videoUrl,
    description,
    published: true,
  });
  const obj = payload as { id?: string } | null;
  const id = obj?.id ?? null;
  return {
    fbPostId: id,
    // permalink_url no siempre viene; construimos uno usable
    fbPermalinkUrl: id
      ? `https://www.facebook.com/${id}`
      : null,
    raw: payload,
  };
}

/**
 * Simula Meta. Los IDs empiezan por `fake_` — no existen en Facebook.
 */
export async function publishDryRun(
  variant: 'feed' | 'photos' | 'videos',
  payload: { message: string; imageUrl?: string; videoUrl?: string },
): Promise<PublishResult> {
  const fakeId = `fake_${variant}_${Date.now().toString(36)}`;
  return {
    fbPostId: fakeId,
    fbPermalinkUrl: `https://facebook.com/dry-run/${fakeId}`,
    raw: { dryRun: true, payload },
  };
}

export async function publishWithRetry(
  publish: () => Promise<PublishResult>,
  label = 'fb-publish',
): Promise<PublishResult> {
  return withRetry(publish, { attempts: 2, delayMs: 1200, label });
}

export function isFacebookConfigured(): boolean {
  refreshEnvFromDisk();
  return Boolean(
    process.env.FB_PAGE_ACCESS_TOKEN?.trim() && process.env.FB_PAGE_ID?.trim(),
  );
}

export function isFacebookDryRun(): boolean {
  refreshEnvFromDisk();
  const raw = (process.env.FB_DRY_RUN ?? '').trim().toLowerCase();
  // Vacío o true → dry-run. Solo "false"/"0"/"off" publica de verdad.
  if (raw === '' || ['true', '1', 'yes', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'off'].includes(raw)) {
    return !isFacebookConfigured();
  }
  // Valor raro → seguro en dry-run
  return true;
}

export function isFakeFbPostId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith('fake_');
}

export type ContentMediaKind = 'image' | 'video' | 'none';

export function detectContentMediaKind(row: {
  fb_photo_url?: unknown;
  metadata?: unknown;
}): ContentMediaKind {
  const url = typeof row.fb_photo_url === 'string' ? row.fb_photo_url : '';
  if (!url) return 'none';
  const meta =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : {};
  const typed = String(meta.media_type ?? '').toLowerCase();
  if (typed === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(url)) return 'video';
  return 'image';
}

/** Publica texto + foto o video según el draft. */
export async function publishRowMedia(
  row: { script_body?: unknown; fb_photo_url?: unknown; metadata?: unknown },
  opts?: { dryRun?: boolean },
): Promise<PublishResult> {
  const message = String(row.script_body ?? '');
  const mediaUrl =
    typeof row.fb_photo_url === 'string' ? row.fb_photo_url : null;
  const kind = detectContentMediaKind(row);

  if (opts?.dryRun) {
    const variant =
      kind === 'video' ? 'videos' : mediaUrl ? 'photos' : 'feed';
    return publishDryRun(variant, {
      message,
      imageUrl: kind === 'image' ? mediaUrl ?? undefined : undefined,
      videoUrl: kind === 'video' ? mediaUrl ?? undefined : undefined,
    });
  }

  if (kind === 'video' && mediaUrl) {
    return publishWithRetry(
      () => publishVideoPost(mediaUrl, message),
      'fb-video',
    );
  }
  if (kind === 'image' && mediaUrl) {
    return publishWithRetry(
      () => publishPhotoPost(mediaUrl, message),
      'fb-photo',
    );
  }
  return publishWithRetry(() => publishFeedPost(message), 'fb-feed');
}
