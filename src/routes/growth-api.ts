import type { FastifyInstance } from 'fastify';
import { createWriteStream } from 'node:fs';
import { mkdir, open, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  createAppConnection,
  getAgentDefinition,
  getContentScriptById,
  getFacebookPublisherSettings,
  listAgentDefinitions,
  listAppConnections,
  listBlogPosts,
  listChatMessages,
  listContentScripts,
  listFacebookPosts,
  listFailedFbPosts,
  listOpportunities,
  listSiteKnowledge,
  updateContentScriptFb,
  upsertBotSetting,
  upsertSiteKnowledge,
} from '../db/growth.js';
import { chatWithAgent } from '../services/agent-chat.js';
import { getAgentState, sendAgentMessage } from '../runtime/state.js';
import { executeAgent } from '../runtime/orchestrator.js';
import { env } from '../config/env.js';
import {
  getFacebookPageDiagnostics,
  isFacebookConfigured,
  isFacebookDryRun,
  publishRowMedia,
} from '../facebook/client.js';
import { fetchInternalSignals, fetchTrendingTopics } from '../facebook/trends.js';
import type { AgentId } from '../agents/types.js';

const FACEBOOK_UPLOAD_ROOT = resolve(
  process.cwd(),
  'public',
  'uploads',
  'facebook',
);
const MAX_FACEBOOK_MEDIA_BYTES = 100 * 1024 * 1024;
const FACEBOOK_MEDIA_TYPES: Record<
  string,
  { extension: string; kind: 'image' | 'video' }
> = {
  'image/jpeg': { extension: 'jpg', kind: 'image' },
  'image/png': { extension: 'png', kind: 'image' },
  'image/webp': { extension: 'webp', kind: 'image' },
  'video/mp4': { extension: 'mp4', kind: 'video' },
  'video/webm': { extension: 'webm', kind: 'video' },
  'video/quicktime': { extension: 'mov', kind: 'video' },
};

function isEditableFacebookPost(row: Record<string, unknown>): boolean {
  return row.publish_status !== 'published' ||
    (typeof row.fb_post_id === 'string' && row.fb_post_id.startsWith('fake_'));
}

function localMediaPath(row: Record<string, unknown>): string | null {
  const metadata =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : {};
  const relative =
    typeof metadata.media_local_path === 'string'
      ? metadata.media_local_path
      : null;
  if (!relative) return null;
  const absolute = resolve(process.cwd(), relative);
  if (
    absolute !== FACEBOOK_UPLOAD_ROOT &&
    !absolute.startsWith(`${FACEBOOK_UPLOAD_ROOT}\\`) &&
    !absolute.startsWith(`${FACEBOOK_UPLOAD_ROOT}/`)
  ) {
    return null;
  }
  return absolute;
}

async function deletePreviousLocalMedia(
  row: Record<string, unknown>,
  exceptPath?: string,
): Promise<void> {
  const oldPath = localMediaPath(row);
  if (!oldPath || oldPath === exceptPath) return;
  await unlink(oldPath).catch(() => undefined);
}

async function hasExpectedMediaSignature(
  filePath: string,
  mime: string,
): Promise<boolean> {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 4) return false;
    if (mime === 'image/jpeg') {
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    }
    if (mime === 'image/png') {
      return header.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    }
    if (mime === 'image/webp') {
      return header.subarray(0, 4).toString() === 'RIFF' &&
        header.subarray(8, 12).toString() === 'WEBP';
    }
    if (mime === 'video/webm') {
      return header.subarray(0, 4).equals(
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      );
    }
    return header.subarray(4, 8).toString() === 'ftyp';
  } finally {
    await handle.close();
  }
}

export async function growthApiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/agents', async () => {
    const defs = await listAgentDefinitions();
    return {
      agents: defs.map((def) => ({
        ...def,
        runtime: getAgentState(def.id as AgentId) ?? null,
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/api/agents/:id', async (request, reply) => {
    const def = await getAgentDefinition(request.params.id);
    if (!def) return reply.code(404).send({ error: 'Agent not found' });
    return {
      agent: def,
      runtime: getAgentState(def.id as AgentId) ?? null,
    };
  });

  app.get<{
    Params: { id: string };
    Querystring: { sessionId?: string };
  }>('/api/agents/:id/chat', async (request) => {
    const sessionId = request.query.sessionId || 'default';
    const messages = await listChatMessages(request.params.id, sessionId);
    return { sessionId, messages };
  });

  app.post<{
    Params: { id: string };
    Body: { sessionId?: string; message?: string };
  }>('/api/agents/:id/chat', async (request, reply) => {
    const message = request.body?.message?.trim();
    if (!message) return reply.code(400).send({ error: 'message required' });
    const sessionId = request.body?.sessionId || `ui-${request.params.id}`;

    try {
      const result = await chatWithAgent({
        agentId: request.params.id,
        sessionId,
        message,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: msg });
    }
  });

  app.post<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>('/api/agents/:id/run', async (request, reply) => {
    try {
      const { result } = await executeAgent(
        request.params.id as AgentId,
        request.log,
        'manual',
        request.body ?? {},
      );
      return { result };
    } catch (err) {
      return reply.code(409).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/opportunities', async () => ({
    opportunities: await listOpportunities(50),
  }));

  app.get('/api/apps', async () => ({
    apps: await listAppConnections(),
  }));

  app.post<{
    Body: {
      name?: string;
      slug?: string;
      platform?: string;
      app_url?: string;
      access_token?: string;
      description?: string;
      features?: unknown;
      brand_voice?: string;
    };
  }>('/api/apps', async (request, reply) => {
    const body = request.body ?? {};
    if (!body.name || !body.slug) {
      return reply.code(400).send({ error: 'name and slug required' });
    }
    const app = await createAppConnection({
      name: body.name,
      slug: body.slug,
      platform: body.platform,
      app_url: body.app_url,
      access_token: body.access_token,
      description: body.description,
      features: body.features,
      brand_voice: body.brand_voice,
    });
    return { app };
  });

  app.get('/api/knowledge', async () => ({
    items: await listSiteKnowledge(),
  }));

  app.post<{
    Body: { key?: string; title?: string; content?: string; source_url?: string };
  }>('/api/knowledge', async (request, reply) => {
    const body = request.body ?? {};
    if (!body.key || !body.title || !body.content) {
      return reply.code(400).send({ error: 'key, title, content required' });
    }
    await upsertSiteKnowledge({
      key: body.key,
      title: body.title,
      content: body.content,
      source_url: body.source_url,
    });
    return { ok: true };
  });

  app.get('/api/content', async () => ({
    blogs: await listBlogPosts(20),
    scripts: await listContentScripts(20),
  }));

  // ─────────────────────────────────────────────────────────────────────
  // Facebook Publisher endpoints
  // ─────────────────────────────────────────────────────────────────────

  app.get<{ Querystring: { limit?: string; status?: string } }>(
    '/api/facebook/posts',
    async (request) => {
      const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 30)));
      const status = request.query.status?.trim() || undefined;
      try {
        const posts = await listFacebookPosts({ status, limit });
        return { posts };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : String(err),
          posts: [],
        };
      }
    },
  );

  app.get('/api/facebook/pending', async () => ({
    posts: await listFacebookPosts({ status: 'pending_review', limit: 50 }),
  }));

  app.get('/api/facebook/failed', async () => ({
    failed: await listFailedFbPosts(20),
  }));

  app.get('/api/facebook/config', async () => {
    const settings = await getFacebookPublisherSettings().catch(() => ({
      mode: 'manual' as const,
      auto_publish: false,
    }));
    return {
      enabled: env.FB_PUBLISHER_ENABLED === true,
      dryRun: isFacebookDryRun(),
      autoPublishEnv: env.FB_AUTO_PUBLISH === true,
      configured: isFacebookConfigured(),
      pageId: env.FB_PAGE_ID ?? null,
      hasToken: Boolean(env.FB_PAGE_ACCESS_TOKEN),
      graphVersion: env.FB_GRAPH_VERSION,
      settings,
      effectiveMode:
        env.FB_AUTO_PUBLISH === true ||
        settings.auto_publish ||
        settings.mode === 'auto'
          ? 'auto'
          : 'manual',
    };
  });

  app.get('/api/facebook/diagnostics', async (_request, reply) => {
    if (!isFacebookConfigured()) {
      return reply.code(409).send({
        ok: false,
        error: 'Falta FB_PAGE_ID o FB_PAGE_ACCESS_TOKEN',
      });
    }
    try {
      const page = await getFacebookPageDiagnostics();
      return { ok: true, page };
    } catch (err) {
      return reply.code(502).send({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post<{
    Body: { mode?: 'manual' | 'auto'; auto_publish?: boolean };
  }>('/api/facebook/config', async (request) => {
    const mode = request.body?.mode === 'auto' ? 'auto' : 'manual';
    const auto_publish =
      typeof request.body?.auto_publish === 'boolean'
        ? request.body.auto_publish
        : mode === 'auto';
    const current = await getFacebookPublisherSettings().catch(() => ({
      mode: 'manual' as const,
      auto_publish: false,
      default_hashtags: ['#MatuByte', '#Software', '#Colombia'],
    }));
    const next = {
      ...current,
      mode,
      auto_publish,
    };
    await upsertBotSetting('facebook_publisher', next);
    return { ok: true, settings: next };
  });

  app.get<{ Querystring: { sources?: string } }>(
    '/api/facebook/trends/preview',
    async (request) => {
      const requested = (request.query.sources ?? 'news,reddit')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const tasks: Array<Promise<unknown[]>> = [];
      if (requested.includes('news')) {
        tasks.push(fetchTrendingTopics({ source: 'news' }).catch(() => []));
      }
      if (requested.includes('reddit')) {
        tasks.push(fetchTrendingTopics({ source: 'reddit' }).catch(() => []));
      }
      const settled = await Promise.all(tasks);
      const items = settled.flat();
      const signalsText = requested.includes('internal')
        ? await fetchInternalSignals().catch(() => '')
        : '';
      return {
        sources: requested,
        count: items.length,
        items: items.slice(0, 30),
        internalSignalsText: signalsText || undefined,
      };
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      script_body?: string;
      hook?: string;
      topic?: string;
      hashtags?: string[];
      fb_photo_url?: string | null;
      media_type?: 'image' | 'video' | 'none';
    };
  }>('/api/facebook/posts/:id', async (request, reply) => {
    const existing = await getContentScriptById(request.params.id);
    if (!existing) return reply.code(404).send({ error: 'Post no encontrado' });
    if (existing.platform !== 'facebook') {
      return reply.code(400).send({ error: 'El post no pertenece a Facebook' });
    }
    const body = request.body ?? {};
    const mediaChanged =
      body.fb_photo_url !== undefined || body.media_type !== undefined;
    if (mediaChanged && !isEditableFacebookPost(existing)) {
      return reply.code(409).send({
        error: 'No se puede cambiar el medio de un post ya publicado',
      });
    }

    if (typeof body.fb_photo_url === 'string') {
      const rawUrl = body.fb_photo_url.trim();
      if (rawUrl && !rawUrl.startsWith('/uploads/facebook/')) {
        try {
          const parsed = new URL(rawUrl);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('scheme');
          }
        } catch {
          return reply.code(400).send({
            error: 'La URL multimedia debe usar http:// o https://',
          });
        }
      }
      body.fb_photo_url = rawUrl || null;
    }

    const nextKind =
      body.fb_photo_url === null
        ? 'none'
        : body.media_type ??
          (typeof body.fb_photo_url === 'string' &&
          /\.(mp4|mov|webm)(\?|$)/i.test(body.fb_photo_url)
            ? 'video'
            : body.fb_photo_url !== undefined
              ? 'image'
              : undefined);
    await updateContentScriptFb(request.params.id, {
      script_body: body.script_body,
      hook: body.hook,
      topic: body.topic,
      hashtags: body.hashtags,
      fb_photo_url: body.fb_photo_url,
      metadata: mediaChanged
        ? {
            media_type: nextKind,
            media_thumb: nextKind === 'none' ? null : body.fb_photo_url,
            media_local_path: null,
            media_original_name: null,
          }
        : undefined,
    });
    if (mediaChanged) await deletePreviousLocalMedia(existing);
    const updated = await getContentScriptById(request.params.id);
    return { ok: true, post: updated };
  });

  app.post<{ Params: { id: string } }>(
    '/api/facebook/posts/:id/media',
    async (request, reply) => {
      const existing = await getContentScriptById(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Post no encontrado' });
      if (existing.platform !== 'facebook') {
        return reply.code(400).send({ error: 'El post no pertenece a Facebook' });
      }
      if (!isEditableFacebookPost(existing)) {
        return reply.code(409).send({
          error: 'No se puede cambiar el medio de un post ya publicado',
        });
      }

      const part = await request.file({
        limits: { files: 1, fileSize: MAX_FACEBOOK_MEDIA_BYTES },
      });
      if (!part) {
        return reply.code(400).send({ error: 'Selecciona una imagen o video' });
      }
      const media = FACEBOOK_MEDIA_TYPES[part.mimetype];
      if (!media) {
        part.file.resume();
        return reply.code(415).send({
          error: 'Formato no permitido. Usa JPG, PNG, WEBP, MP4, WEBM o MOV.',
        });
      }

      await mkdir(FACEBOOK_UPLOAD_ROOT, { recursive: true });
      const filename = `${request.params.id}-${Date.now()}.${media.extension}`;
      const absolutePath = join(FACEBOOK_UPLOAD_ROOT, filename);

      try {
        await pipeline(part.file, createWriteStream(absolutePath, { flags: 'wx' }));
        if (part.file.truncated) {
          await unlink(absolutePath).catch(() => undefined);
          return reply.code(413).send({
            error: 'El archivo supera el límite de 100 MB',
          });
        }
        if (!(await hasExpectedMediaSignature(absolutePath, part.mimetype))) {
          await unlink(absolutePath).catch(() => undefined);
          return reply.code(415).send({
            error: 'El contenido del archivo no coincide con su formato',
          });
        }

        const relativePath = `public/uploads/facebook/${filename}`;
        const publicUrl = `/uploads/facebook/${filename}`;
        await updateContentScriptFb(request.params.id, {
          fb_photo_url: publicUrl,
          error_message: null,
          metadata: {
            media_type: media.kind,
            media_thumb: media.kind === 'image' ? publicUrl : null,
            media_local_path: relativePath,
            media_original_name: part.filename.slice(0, 200),
            media_mime: part.mimetype,
          },
        });
        await deletePreviousLocalMedia(existing, absolutePath);
        const updated = await getContentScriptById(request.params.id);
        return { ok: true, post: updated };
      } catch (err) {
        await unlink(absolutePath).catch(() => undefined);
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { by?: string; forceDryRun?: boolean } }>(
    '/api/facebook/posts/:id/approve',
    async (request, reply) => {
      const existing = await getContentScriptById(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Post no encontrado' });
      if (existing.platform !== 'facebook') {
        return reply.code(400).send({ error: 'El post no pertenece a Facebook' });
      }
      if (existing.publish_status === 'published') {
        return reply.code(409).send({ error: 'Ya publicado', post: existing });
      }

      const forceDryRun = Boolean(request.body?.forceDryRun);
      const dryRun = forceDryRun || isFacebookDryRun();
      if (!dryRun && !isFacebookConfigured()) {
        return reply
          .code(409)
          .send({ error: 'Facebook no configurado (FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN)' });
      }

      await updateContentScriptFb(request.params.id, {
        publish_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: String(request.body?.by ?? 'panel').slice(0, 80),
        rejected_reason: null,
        error_message: null,
      });

      try {
        const approved = await getContentScriptById(request.params.id);
        if (!approved) {
          return reply.code(404).send({ error: 'Post no encontrado al publicar' });
        }
        const result = await publishRowMedia(approved, { dryRun });

        await updateContentScriptFb(request.params.id, {
          fb_post_id: result.fbPostId ?? undefined,
          fb_permalink_url: result.fbPermalinkUrl ?? undefined,
          fb_published_at: new Date().toISOString(),
          publish_status: 'published',
          error_message: null,
        });

        sendAgentMessage({
          from: 'facebook-publisher',
          to: 'broadcast',
          topic: 'facebook.published',
          body: `Aprobado y publicado: ${String(approved.topic ?? '')}`,
          payload: { rowId: request.params.id, dryRun },
        });

        const updated = await getContentScriptById(request.params.id);
        return { ok: true, dryRun, post: updated };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateContentScriptFb(request.params.id, {
          publish_status: 'failed',
          error_message: msg.slice(0, 1000),
        }).catch(() => undefined);
        return reply.code(502).send({ error: msg });
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/facebook/posts/:id/reject',
    async (request, reply) => {
      const existing = await getContentScriptById(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Post no encontrado' });
      if (existing.platform !== 'facebook') {
        return reply.code(400).send({ error: 'El post no pertenece a Facebook' });
      }
      const reason = String(request.body?.reason ?? 'Rechazado en panel').slice(0, 500);
      await updateContentScriptFb(request.params.id, {
        publish_status: 'skipped',
        rejected_reason: reason,
        error_message: reason,
      });
      sendAgentMessage({
        from: 'facebook-publisher',
        to: 'broadcast',
        topic: 'facebook.rejected',
        body: `Rechazado: ${String(existing.topic ?? '')}`,
        payload: { rowId: request.params.id, reason },
      });
      const updated = await getContentScriptById(request.params.id);
      return { ok: true, post: updated };
    },
  );

  app.post<{ Params: { id: string }; Body: { forceDryRun?: boolean } }>(
    '/api/facebook/posts/:id/retry',
    async (request, reply) => {
      const existing = await getContentScriptById(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Post no encontrado' });
      if (existing.platform !== 'facebook') {
        return reply.code(400).send({ error: 'El post no pertenece a Facebook' });
      }
      if (existing.publish_status === 'published') {
        const fake =
          typeof existing.fb_post_id === 'string' &&
          existing.fb_post_id.startsWith('fake_');
        if (!fake) {
          return reply
            .code(409)
            .send({ error: 'El post ya está publicado', post: existing });
        }
        // Era dry-run: permitir re-publicar en vivo
      }

      const forceDryRun = Boolean(request.body?.forceDryRun);
      const dryRun = forceDryRun || isFacebookDryRun();
      if (!dryRun && !isFacebookConfigured()) {
        return reply
          .code(409)
          .send({ error: 'Facebook no configurado y dry-run desactivado' });
      }

      if (dryRun) {
        return reply.code(409).send({
          error:
            'FB_DRY_RUN sigue activo. Pon FB_DRY_RUN=false en .env y reinicia el bot antes de RETRY LIVE.',
        });
      }

      try {
        const result = await publishRowMedia(existing, { dryRun: false });

        await updateContentScriptFb(request.params.id, {
          fb_post_id: result.fbPostId ?? undefined,
          fb_permalink_url: result.fbPermalinkUrl ?? undefined,
          fb_published_at: new Date().toISOString(),
          publish_status: 'published',
          error_message: null,
        });

        const updated = await getContentScriptById(request.params.id);
        return { ok: true, dryRun: false, post: updated };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await updateContentScriptFb(request.params.id, {
          publish_status: 'failed',
          error_message: message.slice(0, 1000),
        }).catch(() => undefined);
        return reply.code(502).send({ error: message });
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/facebook/posts/:id/mark-failed',
    async (request, reply) => {
      const existing = await getContentScriptById(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Post no encontrado' });
      if (existing.platform !== 'facebook') {
        return reply.code(400).send({ error: 'El post no pertenece a Facebook' });
      }
      await updateContentScriptFb(request.params.id, {
        publish_status: 'failed',
        error_message: String(request.body?.reason ?? 'Marcado manualmente'),
      });
      const updated = await getContentScriptById(request.params.id);
      return { ok: true, post: updated };
    },
  );

  app.post('/api/facebook/generate', async (request, reply) => {
    if (!env.FB_PUBLISHER_ENABLED) {
      return reply
        .code(409)
        .send({ error: 'FB_PUBLISHER_ENABLED=false — actívalo en .env' });
    }
    try {
      const { result } = await executeAgent(
        'facebook-publisher',
        request.log,
        'manual',
        { forceAutoPublish: false },
      );
      return { ok: result.status === 'ok', result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: message });
    }
  });
}
