import type { FastifyInstance } from 'fastify';
import {
  assertOrgAccess,
  createOrganization,
  createProject,
  getOrganization,
  getProject,
  listOrganizationsForUser,
  listProjectSecretKeys,
  listProjectSettings,
  listProjects,
  setProjectSecret,
  setProjectSetting,
  updateProject,
  type ProjectType,
} from '../tenancy/store.js';
import {
  addProjectAgent,
  getProjectAgent,
  listProjectAgentCatalog,
  listProjectAgentViews,
  removeProjectAgent,
  updateProjectAgent,
} from '../db/project-agents.js';
import { scheduleProjectAgentRun } from '../runtime/orchestrator.js';
import { requireAuth } from '../tenancy/auth.js';
import { invalidateProjectConfigCache } from '../tenancy/project-config.js';

const SECRET_KEYS = [
  'llm_api_key',
  'whatsapp_access_token',
  'whatsapp_phone_number_id',
  'whatsapp_business_account_id',
  'whatsapp_verify_token',
  'whatsapp_owner_phone',
  'facebook_page_access_token',
  'facebook_page_id',
] as const;

const SETTING_KEYS = [
  'llm_provider',
  'llm_model',
  'llm_base_url',
  'whatsapp_enabled',
  'whatsapp_cta_url',
  'whatsapp_handoff_keywords',
  'facebook_enabled',
  'facebook_dry_run',
  'facebook_auto_publish',
  'facebook_custom_prompt',
  'brand_name',
  'brand_knowledge',
  'brand_profile',
  'hunt_sources',
  'features',
] as const;

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

export async function tenancyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/organizations', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const organizations = await listOrganizationsForUser(user.id);
    return { organizations };
  });

  app.post('/api/organizations', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const body = (request.body ?? {}) as { name?: string; slug?: string };
    if (!body.name) {
      return reply.code(400).send({ error: 'name is required' });
    }
    try {
      const organization = await createOrganization({
        name: body.name,
        slug: body.slug,
        ownerUserId: user.id,
      });
      return { organization };
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/organizations/:orgId/projects', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { orgId } = request.params as { orgId: string };
    try {
      await assertOrgAccess(orgId, user.id);
    } catch (err) {
      return reply
        .code(403)
        .send({ error: err instanceof Error ? err.message : 'Forbidden' });
    }
    const projects = await listProjects(orgId);
    return { projects };
  });

  app.post('/api/organizations/:orgId/projects', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { orgId } = request.params as { orgId: string };
    try {
      await assertOrgAccess(orgId, user.id, 'admin');
    } catch (err) {
      return reply
        .code(403)
        .send({ error: err instanceof Error ? err.message : 'Forbidden' });
    }

    const body = (request.body ?? {}) as {
      name?: string;
      slug?: string;
      type?: ProjectType;
      brandName?: string;
      autopilotEnabled?: boolean;
    };
    if (!body.name) {
      return reply.code(400).send({ error: 'name is required' });
    }

    try {
      const project = await createProject({
        organizationId: orgId,
        name: body.name,
        slug: body.slug,
        type: body.type,
        brandName: body.brandName,
        autopilotEnabled: body.autopilotEnabled,
      });
      return { project };
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/projects/:projectId', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const project = await getProject(projectId);
    if (!project) return reply.code(404).send({ error: 'Not found' });
    try {
      await assertOrgAccess(project.organization_id, user.id);
    } catch {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const org = await getOrganization(project.organization_id);
    const settings = await listProjectSettings(projectId);
    const secretKeys = await listProjectSecretKeys(projectId);
    return { project, organization: org, settings, secretKeys };
  });

  app.patch('/api/projects/:projectId', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const project = await getProject(projectId);
    if (!project) return reply.code(404).send({ error: 'Not found' });
    try {
      await assertOrgAccess(project.organization_id, user.id, 'admin');
    } catch {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const body = (request.body ?? {}) as {
      name?: string;
      brand_name?: string;
      type?: ProjectType;
      is_active?: boolean;
      autopilot_enabled?: boolean;
    };

    const updated = await updateProject(projectId, body);
    invalidateProjectConfigCache(projectId);
    return { project: updated };
  });

  app.put('/api/projects/:projectId/settings/:key', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, key } = request.params as { projectId: string; key: string };
    const project = await getProject(projectId);
    if (!project) return reply.code(404).send({ error: 'Not found' });
    try {
      await assertOrgAccess(project.organization_id, user.id, 'admin');
    } catch {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const body = (request.body ?? {}) as { value?: unknown };
    if (body.value === undefined) {
      return reply.code(400).send({ error: 'value is required' });
    }
    await setProjectSetting(projectId, key, body.value);
    invalidateProjectConfigCache(projectId);
    return { ok: true, key };
  });

  app.put('/api/projects/:projectId/secrets/:key', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, key } = request.params as { projectId: string; key: string };
    const project = await getProject(projectId);
    if (!project) return reply.code(404).send({ error: 'Not found' });
    try {
      await assertOrgAccess(project.organization_id, user.id, 'admin');
    } catch {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const body = (request.body ?? {}) as { value?: string };
    if (!body.value || typeof body.value !== 'string') {
      return reply.code(400).send({ error: 'value (string) is required' });
    }
    await setProjectSecret(projectId, key, body.value);
    invalidateProjectConfigCache(projectId);
    return { ok: true, key };
  });

  app.get('/api/projects/:projectId/settings', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return reply.code(404).send({ error: 'Not found' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Forbidden' });

    const allSettings = await listProjectSettings(projectId);
    const settingsMap: Record<string, unknown> = {};
    for (const row of allSettings) settingsMap[row.key] = row.value;

    const secretKeys = await listProjectSecretKeys(projectId);
    const secretsConfigured: Record<string, boolean> = {};
    for (const key of SECRET_KEYS) {
      secretsConfigured[key] = secretKeys.includes(key);
    }

    return {
      project: check.project,
      settings: settingsMap,
      secretsConfigured,
      keys: {
        settings: [...SETTING_KEYS],
        secrets: [...SECRET_KEYS],
      },
    };
  });

  app.put('/api/projects/:projectId/settings', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return reply.code(404).send({ error: 'Not found' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Forbidden' });

    const body = (request.body ?? {}) as {
      settings?: Record<string, unknown>;
      secrets?: Record<string, string>;
    };

    if (body.settings) {
      for (const [key, value] of Object.entries(body.settings)) {
        await setProjectSetting(projectId, key, value);
      }
    }
    if (body.secrets) {
      for (const [key, value] of Object.entries(body.secrets)) {
        if (value && typeof value === 'string') {
          await setProjectSecret(projectId, key, value);
        }
      }
    }
    invalidateProjectConfigCache(projectId);
    return { ok: true };
  });

  app.get('/api/projects/:projectId/agents', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return reply.code(404).send({ error: 'Not found' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Forbidden' });

    const agents = await listProjectAgentViews(projectId, true);
    return { agents };
  });

  app.get('/api/projects/:projectId/agents/catalog', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return reply.code(404).send({ error: 'Not found' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Forbidden' });

    const { isContentGatedAgent } = await import('../db/custom-agents.js');
    const { getProjectSetting } = await import('../tenancy/store.js');
    const features = await getProjectSetting<{ blogs?: boolean; content_enabled?: boolean }>(
      projectId,
      'features',
    );
    const contentEnabled = Boolean(
      check.project?.content_enabled || features?.blogs || features?.content_enabled,
    );
    const catalog = (await listProjectAgentCatalog(projectId)).filter(
      (a) => contentEnabled || !isContentGatedAgent(a.id),
    );
    return { catalog, contentEnabled };
  });

  app.post('/api/projects/:projectId/agents', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return reply.code(404).send({ error: 'Not found' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Forbidden' });

    const body = (request.body ?? {}) as { agentId?: string };
    if (!body.agentId) {
      return reply.code(400).send({ error: 'agentId is required' });
    }

    const { isBrandConfigured } = await import('../services/brand-setup.js');
    if (!(await isBrandConfigured(projectId))) {
      return reply
        .code(409)
        .send({ error: 'Configura tu marca en /setup antes de activar agentes' });
    }

    const { isContentGatedAgent } = await import('../db/custom-agents.js');
    const { getProjectSetting } = await import('../tenancy/store.js');
    const features = await getProjectSetting<{ blogs?: boolean; content_enabled?: boolean }>(
      projectId,
      'features',
    );
    const contentEnabled = Boolean(
      check.project?.content_enabled || features?.blogs || features?.content_enabled,
    );
    if (isContentGatedAgent(body.agentId) && !contentEnabled) {
      return reply.code(403).send({
        error:
          'Este agente de contenido no está habilitado para tu plan. Contacta a MatuByte.',
      });
    }

    try {
      const row = await addProjectAgent(projectId, body.agentId);
      return { projectAgent: row };
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch('/api/projects/:projectId/agents/:agentId', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, agentId } = request.params as {
      projectId: string;
      agentId: string;
    };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return reply.code(404).send({ error: 'Not found' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Forbidden' });

    const body = (request.body ?? {}) as {
      is_enabled?: boolean;
      autopilot_enabled?: boolean;
      config?: Record<string, unknown>;
    };

    try {
      const existing = await getProjectAgent(projectId, agentId);
      if (!existing) {
        return reply.code(404).send({ error: 'Agent not added to this project' });
      }

      const patch = { ...body };
      if (typeof patch.is_enabled === 'boolean') {
        patch.autopilot_enabled = patch.is_enabled;
      }

      const row = await updateProjectAgent(projectId, agentId, patch);

      if (patch.is_enabled === true && !existing.is_enabled) {
        scheduleProjectAgentRun(projectId, agentId, request.log);
      }

      return { projectAgent: row };
    } catch (err) {
      return reply
        .code(404)
        .send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/projects/:projectId/agents/:agentId', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, agentId } = request.params as {
      projectId: string;
      agentId: string;
    };
    const check = await assertProjectMember(projectId, user.id, 'admin');
    if (check.error === 'not_found') return reply.code(404).send({ error: 'Not found' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Forbidden' });

    await removeProjectAgent(projectId, agentId);
    return { ok: true };
  });
}
