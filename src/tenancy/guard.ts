import type { FastifyInstance } from 'fastify';
import {
  assertOrgAccess,
  getProject,
  resolveUserFromToken,
} from '../tenancy/store.js';
import { enterTenant } from '../tenancy/context.js';
import { extractBearerToken, getProjectIdFromRequest } from '../tenancy/auth.js';

const PUBLIC_PREFIXES = [
  '/api/auth',
  '/api/public',
  '/webhooks',
  '/health',
  '/api/admin/push',
];

function isPublicPath(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  if (path === '/' || path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
    return true;
  }
  if (path.startsWith('/uploads/')) return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function needsProjectContext(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  if (path.startsWith('/api/organizations')) return false;
  if (path.startsWith('/api/projects/')) {
    if (path.includes('/settings') || path.includes('/secrets')) return false;
    if (path.includes('/agents')) return false;
    if (/^\/api\/projects\/[^/]+$/.test(path)) return false;
  }
  if (path.startsWith('/api/auth')) return false;
  if (path.startsWith('/api/') || path.startsWith('/agents')) return true;
  return false;
}

function isProjectManagementPath(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return (
    path.startsWith('/api/organizations') ||
    path.startsWith('/api/projects')
  );
}

/**
 * Auth + X-Project-Id for cockpit APIs. Webhooks/static/auth stay public.
 */
export async function registerTenantGuard(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const url = request.url;
    if (isPublicPath(url)) return;
    if (!needsProjectContext(url)) {
      // Still require auth for org/project management routes
      if (isProjectManagementPath(url)) {
        const token = extractBearerToken(request);
        if (!token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const user = await resolveUserFromToken(token);
        if (!user) {
          return reply.code(401).send({ error: 'Invalid or expired session' });
        }
        request.user = user;
      }
      return;
    }

    const token = extractBearerToken(request);
    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const user = await resolveUserFromToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid or expired session' });
    }
    request.user = user;

    const projectId = getProjectIdFromRequest(request);
    if (!projectId) {
      return reply.code(400).send({
        error: 'Missing X-Project-Id header (or ?projectId=)',
      });
    }

    const project = await getProject(projectId);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    try {
      await assertOrgAccess(project.organization_id, user.id, 'member');
    } catch (err) {
      return reply.code(403).send({
        error: err instanceof Error ? err.message : 'Forbidden',
      });
    }

    const ctx = {
      userId: user.id,
      organizationId: project.organization_id,
      projectId: project.id,
    };
    request.tenant = ctx;
    enterTenant(ctx);
  });
}
