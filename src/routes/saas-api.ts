import type { FastifyInstance } from 'fastify';
import {
  createCustomAgent,
  deleteCustomAgent,
  getCustomAgent,
  isContentGatedAgent,
  listCustomAgents,
  runCustomAgent,
  updateCustomAgent,
} from '../db/custom-agents.js';
import {
  addProjectAgent,
  listProjectAgentCatalog,
  listProjectAgentViews,
  updateProjectAgent,
} from '../db/project-agents.js';
import { createNotification } from '../db/notifications.js';
import { requireAuth } from '../tenancy/auth.js';
import {
  assertOrgAccess,
  getProject,
  getProjectSetting,
  listProjectSecretKeys,
  setProjectSetting,
} from '../tenancy/store.js';
import {
  DEFAULT_HUNT_SOURCES,
  isBrandConfigured,
  saveBrandAuto,
  saveBrandManual,
} from '../services/brand-setup.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import { listChatMessages } from '../db/growth.js';
import { db } from '../db/matu.js';
import { invalidateProjectConfigCache } from '../tenancy/project-config.js';
import { scheduleProjectAgentRun } from '../runtime/orchestrator.js';
import { customAgentRunId } from '../agents/agent-ids.js';
import { buildAgentInsights, buildCustomAgentInsights } from '../services/agent-insights.js';
import { streamChatWithCustomAgent } from '../services/agent-chat.js';
import { transcribeAudioBuffer } from '../services/transcribe-audio.js';

async function assertProjectMember(
  projectId: string,
  userId: string,
  minRole: 'member' | 'admin' = 'member',
) {
  const project = await getProject(projectId);
  if (!project) return { project: null, error: 'not_found' as const };
  try {
    await assertOrgAccess(project.organization_id, userId, minRole);
  } catch {
    return { project: null, error: 'forbidden' as const };
  }
  return { project, error: null };
}

async function projectHasContent(projectId: string, project: { content_enabled?: boolean }) {
  if (project.content_enabled) return true;
  const features = await getProjectSetting<{ blogs?: boolean; content_enabled?: boolean }>(
    projectId,
    'features',
  );
  return Boolean(features?.blogs || features?.content_enabled);
}

function err(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, code: number, message: string) {
  return reply.code(code).send({ error: message });
}

export async function saasApiRoutes(app: FastifyInstance): Promise<void> {
  // ——— Brand setup ———
  app.get('/api/projects/:projectId/setup/status', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    const brandOk = await isBrandConfigured(projectId);
    const secretKeys = await listProjectSecretKeys(projectId);
    const waOk =
      secretKeys.includes('whatsapp_access_token') &&
      secretKeys.includes('whatsapp_phone_number_id');
    const fbOk =
      secretKeys.includes('facebook_page_access_token') &&
      secretKeys.includes('facebook_page_id');
    const llmOk = secretKeys.includes('llm_api_key');
    const contentEnabled = await projectHasContent(projectId, check.project!);
    const profile = await getProjectSetting(projectId, 'brand_profile');
    const huntSources =
      (await getProjectSetting(projectId, 'hunt_sources')) ?? DEFAULT_HUNT_SOURCES;

    return {
      brandConfigured: brandOk,
      whatsappConfigured: waOk,
      facebookConfigured: fbOk,
      llmConfigured: llmOk,
      contentEnabled,
      brandProfile: profile,
      huntSources,
      project: {
        id: check.project!.id,
        name: check.project!.name,
        brand_name: check.project!.brand_name,
        content_enabled: check.project!.content_enabled ?? false,
        brand_configured: check.project!.brand_configured ?? false,
      },
    };
  });

  app.post('/api/projects/:projectId/setup/brand/manual', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    const body = (request.body ?? {}) as {
      brand_name?: string;
      description?: string;
      country?: string;
      phone?: string;
      website?: string;
      socials?: Record<string, string>;
    };
    if (!body.brand_name?.trim() || !body.description?.trim()) {
      return err(reply, 400, 'Nombre de marca y descripción son requeridos');
    }
    try {
      const profile = await saveBrandManual(projectId, {
        brand_name: body.brand_name,
        description: body.description,
        country: body.country,
        phone: body.phone,
        website: body.website,
        socials: body.socials,
      });
      invalidateProjectConfigCache(projectId);
      await createNotification({
        projectId,
        organizationId: check.project!.organization_id,
        userId: user.id,
        type: 'brand',
        title: 'Marca configurada',
        body: `Perfil de ${profile.brand_name} guardado (manual).`,
        link: '/settings/brand',
      }).catch(() => undefined);
      return { ok: true, profile };
    } catch (e) {
      return err(reply, 400, e instanceof Error ? e.message : String(e));
    }
  });

  app.post('/api/projects/:projectId/setup/brand/auto', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    const body = (request.body ?? {}) as {
      websiteUrl?: string;
      googleMapsUrl?: string;
      socials?: Record<string, string>;
    };
    if (!body.websiteUrl?.trim()) {
      return err(reply, 400, 'websiteUrl es requerido');
    }
    try {
      const profile = await saveBrandAuto(projectId, {
        websiteUrl: body.websiteUrl,
        googleMapsUrl: body.googleMapsUrl,
        socials: body.socials,
      });
      invalidateProjectConfigCache(projectId);
      await createNotification({
        projectId,
        organizationId: check.project!.organization_id,
        userId: user.id,
        type: 'brand',
        title: 'Marca detectada automáticamente',
        body: `Se extrajo el perfil de ${profile.brand_name}.`,
        link: '/setup',
      }).catch(() => undefined);
      return { ok: true, profile };
    } catch (e) {
      return err(reply, 400, e instanceof Error ? e.message : String(e));
    }
  });

  app.put('/api/projects/:projectId/hunt-sources', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    const body = (request.body ?? {}) as { sources?: Record<string, unknown> };
    const sources = { ...DEFAULT_HUNT_SOURCES, ...(body.sources ?? {}) };
    await setProjectSetting(projectId, 'hunt_sources', sources);
    return { ok: true, sources };
  });

  // ——— Agents catalog with content gating ———
  app.get('/api/projects/:projectId/agents/full', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    const contentEnabled = await projectHasContent(projectId, check.project!);
    const [agents, catalog, custom] = await Promise.all([
      listProjectAgentViews(projectId, false),
      listProjectAgentCatalog(projectId),
      listCustomAgents(projectId),
    ]);

    const filteredCatalog = catalog.filter(
      (a) => contentEnabled || !isContentGatedAgent(a.id),
    );
    const filteredAgents = agents.filter(
      (a) => contentEnabled || !isContentGatedAgent(a.id),
    );

    return {
      agents: filteredAgents,
      catalog: filteredCatalog,
      customAgents: custom,
      contentEnabled,
      brandConfigured: await isBrandConfigured(projectId),
    };
  });

  app.get('/api/projects/:projectId/agents/:agentId/insights', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, agentId } = request.params as {
      projectId: string;
      agentId: string;
    };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    return buildAgentInsights(projectId, agentId);
  });

  app.post('/api/projects/:projectId/agents/activate', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    if (!(await isBrandConfigured(projectId))) {
      return err(reply, 409, 'Configura tu marca en /setup antes de activar agentes');
    }

    const body = (request.body ?? {}) as {
      agentId?: string;
      config?: Record<string, unknown>;
      autopilot_enabled?: boolean;
    };
    if (!body.agentId) return err(reply, 400, 'agentId es requerido');

    const contentEnabled = await projectHasContent(projectId, check.project!);
    if (isContentGatedAgent(body.agentId) && !contentEnabled) {
      return err(
        reply,
        403,
        'Este agente de contenido no está habilitado para tu plan. Contacta a MatuByte.',
      );
    }

    try {
      const row = await addProjectAgent(projectId, body.agentId);
      await updateProjectAgent(projectId, body.agentId, {
        is_enabled: true,
        autopilot_enabled: true,
        ...(body.config ? { config: body.config } : {}),
      });
      scheduleProjectAgentRun(projectId, body.agentId, request.log);
      await createNotification({
        projectId,
        organizationId: check.project!.organization_id,
        userId: user.id,
        type: 'agent',
        title: 'Agente activado',
        body: `Se activó el agente ${body.agentId}.`,
        link: '/agentes',
      }).catch(() => undefined);
      return { projectAgent: row };
    } catch (e) {
      return err(reply, 400, e instanceof Error ? e.message : String(e));
    }
  });

  // ——— Custom agents ———
  app.get('/api/projects/:projectId/custom-agents', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');
    return { customAgents: await listCustomAgents(projectId) };
  });

  app.post('/api/projects/:projectId/custom-agents', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    if (!(await isBrandConfigured(projectId))) {
      return err(reply, 409, 'Configura tu marca en /setup antes de crear agentes');
    }

    const body = (request.body ?? {}) as {
      name?: string;
      goal?: string;
      systemPrompt?: string;
      scheduleHint?: string;
      config?: Record<string, unknown>;
    };
    if (!body.name?.trim() || !body.goal?.trim()) {
      return err(reply, 400, 'name y goal son requeridos');
    }
    try {
      const agent = await createCustomAgent({
        projectId,
        organizationId: check.project!.organization_id,
        name: body.name,
        goal: body.goal,
        systemPrompt: body.systemPrompt,
        scheduleHint: body.scheduleHint,
        config: body.config,
      });
      void runCustomAgent(projectId, agent.id).catch(() => undefined);
      return { customAgent: agent };
    } catch (e) {
      return err(reply, 400, e instanceof Error ? e.message : String(e));
    }
  });

  app.patch('/api/projects/:projectId/custom-agents/:id', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, id } = request.params as { projectId: string; id: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    const body = (request.body ?? {}) as {
      is_enabled?: boolean;
      autopilot_enabled?: boolean;
      goal?: string;
      systemPrompt?: string;
      scheduleHint?: string;
      config?: Record<string, unknown>;
    };
    try {
      const existing = await getCustomAgent(projectId, id);
      if (!existing) return err(reply, 404, 'No encontrado');

      const patch: Parameters<typeof updateCustomAgent>[2] = {};
      if (typeof body.is_enabled === 'boolean') {
        patch.is_enabled = body.is_enabled;
        patch.autopilot_enabled = body.is_enabled;
      }
      if (typeof body.autopilot_enabled === 'boolean') {
        patch.autopilot_enabled = body.autopilot_enabled;
      }
      if (body.goal !== undefined) patch.goal = body.goal.trim();
      if (body.systemPrompt !== undefined) {
        patch.system_prompt = body.systemPrompt.trim() || null;
      }
      if (body.scheduleHint !== undefined) {
        patch.schedule_hint = body.scheduleHint.trim() || null;
      }
      if (body.config !== undefined) patch.config = body.config;

      const agent = await updateCustomAgent(projectId, id, patch);

      if (patch.is_enabled === true && !existing.is_enabled) {
        void runCustomAgent(projectId, id).catch(() => undefined);
      }

      return { customAgent: agent };
    } catch (e) {
      return err(reply, 400, e instanceof Error ? e.message : String(e));
    }
  });

  app.get('/api/projects/:projectId/custom-agents/:id/insights', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, id } = request.params as { projectId: string; id: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');
    try {
      return await buildCustomAgentInsights(projectId, id);
    } catch (e) {
      return err(reply, 400, e instanceof Error ? e.message : String(e));
    }
  });

  app.get('/api/projects/:projectId/custom-agents/:id/chat', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, id } = request.params as { projectId: string; id: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');
    const sessionId =
      (request.query as { sessionId?: string }).sessionId || `ui-custom-${id}`;
    const messages = await listChatMessages(customAgentRunId(id), sessionId);
    return { sessionId, messages };
  });

  app.post('/api/projects/:projectId/custom-agents/:id/chat/stream', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, id } = request.params as { projectId: string; id: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    const body = (request.body ?? {}) as { sessionId?: string; message?: string };
    const message = body.message?.trim();
    if (!message) return err(reply, 400, 'message required');
    const sessionId = body.sessionId || `ui-custom-${id}`;

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const chunk of streamChatWithCustomAgent({
        projectId,
        customId: id,
        sessionId,
        message,
      })) {
        if (chunk.type === 'thinking') send('thinking', {});
        else if (chunk.type === 'token') send('token', { text: chunk.text });
        else if (chunk.type === 'done') send('done', { reply: chunk.reply, sessionId: chunk.sessionId });
      }
    } catch (err) {
      send('error', { message: err instanceof Error ? err.message : String(err) });
    } finally {
      reply.raw.end();
    }
  });

  app.delete('/api/projects/:projectId/custom-agents/:id', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, id } = request.params as { projectId: string; id: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');
    await deleteCustomAgent(projectId, id);
    return { ok: true };
  });

  app.post('/api/projects/:projectId/custom-agents/:id/run', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, id } = request.params as { projectId: string; id: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    if (!(await isBrandConfigured(projectId))) {
      return err(reply, 409, 'Configura tu marca en /setup antes de ejecutar agentes');
    }

    try {
      const result = await runCustomAgent(projectId, id);
      const agent = await getCustomAgent(projectId, id);
      await createNotification({
        projectId,
        organizationId: check.project!.organization_id,
        userId: user.id,
        type: 'agent_run',
        title: `Agente «${agent?.name ?? id}» ejecutado`,
        body: result.summary.slice(0, 240),
        link: '/agentes',
      }).catch(() => undefined);
      return { ok: true, ...result, agent };
    } catch (e) {
      return err(reply, 400, e instanceof Error ? e.message : String(e));
    }
  });

  // ——— Company AI chat ———
  app.get('/api/projects/:projectId/company-chat', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    const sessionId = String((request.query as { sessionId?: string }).sessionId || 'default');
    const { data, error } = await db
      .from('company_chat_messages')
      .select('*')
      .eq('project_id', projectId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(80);
    if (error) return err(reply, 500, String(error));
    return { messages: data ?? [], llmConfigured: await isLlmConfigured() };
  });

  app.post('/api/projects/:projectId/company-chat/transcribe', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    const file = await request.file();
    if (!file) return err(reply, 400, 'Archivo de audio requerido');

    const buffer = await file.toBuffer();
    if (buffer.length < 800) {
      return err(reply, 400, 'Grabación muy corta. Habla un poco más.');
    }

    const ext = file.filename?.split('.').pop() || 'wav';
    try {
      const text = await transcribeAudioBuffer(buffer, ext);
      return { text };
    } catch (e) {
      request.log.error({ err: e }, 'voice transcribe failed');
      return err(
        reply,
        500,
        e instanceof Error ? e.message : 'No se pudo transcribir el audio',
      );
    }
  });

  app.post('/api/projects/:projectId/company-chat', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return err(reply, 404, 'No encontrado');
    if (check.error === 'forbidden') return err(reply, 403, 'Prohibido');

    if (!(await isLlmConfigured())) {
      return err(reply, 409, 'Configura el LLM en Ajustes → LLM / IA antes de chatear');
    }

    const body = (request.body ?? {}) as { message?: string; sessionId?: string };
    if (!body.message?.trim()) return err(reply, 400, 'message es requerido');
    const sessionId = body.sessionId?.trim() || 'default';

    await db.from('company_chat_messages').insert({
      project_id: projectId,
      organization_id: check.project!.organization_id,
      user_id: user.id,
      session_id: sessionId,
      role: 'user',
      content: body.message.trim(),
    });

    const { data: history } = await db
      .from('company_chat_messages')
      .select('role, content')
      .eq('project_id', projectId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(30);

    const brandName =
      (await getProjectSetting<string>(projectId, 'brand_name')) ||
      check.project!.brand_name ||
      check.project!.name;
    const knowledge =
      (await getProjectSetting<string>(projectId, 'brand_knowledge')) || '';

    const completion = await chatCompletion({
      temperature: 0.7,
      maxTokens: 1000,
      messages: [
        {
          role: 'system',
          content: `Eres el asistente de IA de la empresa «${brandName}» dentro de MatuByte Growth Factory.
Responde en español, claro y accionable.
Conocimiento de marca:
${knowledge.slice(0, 5000) || '(sin configurar — sugiere ir a /setup)'}`,
        },
        ...((history ?? []) as Array<{ role: string; content: string }>).map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ],
    });

    await db.from('company_chat_messages').insert({
      project_id: projectId,
      organization_id: check.project!.organization_id,
      user_id: user.id,
      session_id: sessionId,
      role: 'assistant',
      content: completion.content,
    });

    return { reply: completion.content, sessionId };
  });
}
