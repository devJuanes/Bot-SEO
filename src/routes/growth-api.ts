import type { FastifyInstance } from 'fastify';
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
  isFacebookConfigured,
  isFacebookDryRun,
  publishDryRun,
  publishFeedPost,
  publishPhotoPost,
  publishWithRetry,
} from '../facebook/client.js';
import { fetchInternalSignals, fetchTrendingTopics } from '../facebook/trends.js';
import type { AgentId } from '../agents/types.js';

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
    };
  }>('/api/facebook/posts/:id', async (request, reply) => {
    const existing = await getContentScriptById(request.params.id);
    if (!existing) return reply.code(404).send({ error: 'Post no encontrado' });
    if (existing.platform !== 'facebook') {
      return reply.code(400).send({ error: 'El post no pertenece a Facebook' });
    }
    const body = request.body ?? {};
    await updateContentScriptFb(request.params.id, {
      script_body: body.script_body,
      hook: body.hook,
      topic: body.topic,
      hashtags: body.hashtags,
      fb_photo_url: body.fb_photo_url,
    });
    const updated = await getContentScriptById(request.params.id);
    return { ok: true, post: updated };
  });

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

      const message = String(existing.script_body ?? '');
      const photoUrl =
        typeof existing.fb_photo_url === 'string' ? existing.fb_photo_url : null;

      try {
        const result = await (async () => {
          if (dryRun) {
            return publishDryRun(photoUrl ? 'photos' : 'feed', {
              message,
              imageUrl: photoUrl ?? undefined,
            });
          }
          if (photoUrl) {
            return publishWithRetry(
              () => publishPhotoPost(photoUrl, message),
              'fb-photo-approve',
            );
          }
          return publishWithRetry(
            () => publishFeedPost(message),
            'fb-feed-approve',
          );
        })();

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
          body: `Aprobado y publicado: ${String(existing.topic ?? '')}`,
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
        return reply
          .code(409)
          .send({ error: 'El post ya está publicado', post: existing });
      }

      const forceDryRun = Boolean(request.body?.forceDryRun);
      const dryRun = forceDryRun || isFacebookDryRun();
      if (!dryRun && !isFacebookConfigured()) {
        return reply
          .code(409)
          .send({ error: 'Facebook no configurado y dry-run desactivado' });
      }

      const message = String(existing.script_body ?? '');
      const photoUrl =
        typeof existing.fb_photo_url === 'string' ? existing.fb_photo_url : null;

      try {
        const result = await (async () => {
          if (dryRun) {
            return publishDryRun(photoUrl ? 'photos' : 'feed', {
              message,
              imageUrl: photoUrl ?? undefined,
            });
          }
          if (photoUrl) {
            return publishWithRetry(
              () => publishPhotoPost(photoUrl, message),
              'fb-photo-retry',
            );
          }
          return publishWithRetry(
            () => publishFeedPost(message),
            'fb-feed-retry',
          );
        })();

        await updateContentScriptFb(request.params.id, {
          fb_post_id: result.fbPostId ?? undefined,
          fb_permalink_url: result.fbPermalinkUrl ?? undefined,
          fb_published_at: new Date().toISOString(),
          publish_status: 'published',
          error_message: null,
        });

        const updated = await getContentScriptById(request.params.id);
        return { ok: true, dryRun, post: updated };
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
