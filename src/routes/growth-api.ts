import type { FastifyInstance } from 'fastify';
import {
  createAppConnection,
  getAgentDefinition,
  listAgentDefinitions,
  listAppConnections,
  listBlogPosts,
  listChatMessages,
  listContentScripts,
  listOpportunities,
  listSiteKnowledge,
  upsertSiteKnowledge,
} from '../db/growth.js';
import { chatWithAgent } from '../services/agent-chat.js';
import { getAgentState } from '../runtime/state.js';
import { executeAgent } from '../runtime/orchestrator.js';
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
}
