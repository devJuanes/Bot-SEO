import type { FastifyInstance } from 'fastify';
import {
  createAppConnection,
  getAgentDefinition,
  getContentScriptById,
  listAgentDefinitions,
  listAppConnections,
  listBlogPosts,
  listChatMessages,
  listContentScripts,
  listFailedFbPosts,
  listOpportunities,
  listSiteKnowledge,
  updateContentScriptFb,
  upsertSiteKnowledge,
} from '../db/growth.js';
import { chatWithAgent } from '../services/agent-chat.js';
import { getAgentState } from '../runtime/state.js';
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

  app.get<{ Querystring: { limit?: string } }>(
    '/api/facebook/posts',
    async (request) => {
      const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 20)));
      const { db } = await import('../db/matu.js');
      const { data, error } = await db
        .from('content_scripts')
        .select('*')
        .eq('platform', 'facebook')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        return { error: error.message ?? String(error), posts: [] };
      }
      return { posts: (data ?? []) as Record<string, unknown>[] };
    },
  );

  app.get('/api/facebook/failed', async () => ({
    failed: await listFailedFbPosts(20),
  }));

  app.get('/api/facebook/config', async () => ({
    enabled: env.FB_PUBLISHER_ENABLED === true,
    dryRun: isFacebookDryRun(),
    configured: isFacebookConfigured(),
    pageId: env.FB_PAGE_ID ?? null,
    hasToken: Boolean(env.FB_PAGE_ACCESS_TOKEN),
    graphVersion: env.FB_GRAPH_VERSION,
  }));

  app.get<{ Querystring: { sources?: string } }>(
    '/api/facebook/trends/preview',
    async (request) => {
      const requested = (request.query.sources ?? 'news,reddit')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const tasks: Array<Promise<unknown[]>> = [];
      if (requested.includes('news')) {
        tasks.push(
          fetchTrendingTopics({ source: 'news' }).catch(() => []),
        );
      }
      if (requested.includes('reddit')) {
        tasks.push(
          fetchTrendingTopics({ source: 'reddit' }).catch(() => []),
        );
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
}
