import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  assertOrgAccess,
  getProject,
  resolveUserFromToken,
  type PublicUser,
} from './store.js';
import { runWithTenantAsync, type TenantContext } from './context.js';

export function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim() || null;
  }
  const cookie = request.headers.cookie ?? '';
  const match = /(?:^|;\s*)growth_token=([^;]+)/.exec(cookie);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<PublicUser | null> {
  const token = extractBearerToken(request);
  if (!token) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return null;
  }
  const user = await resolveUserFromToken(token);
  if (!user) {
    await reply.code(401).send({ error: 'Invalid or expired session' });
    return null;
  }
  request.user = user;
  return user;
}

export function getProjectIdFromRequest(request: FastifyRequest): string | null {
  const header = request.headers['x-project-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const q = (request.query as { projectId?: string } | undefined)?.projectId;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return null;
}

/**
 * Auth + membership + AsyncLocalStorage tenant context for the handler.
 */
export async function withProjectContext(
  request: FastifyRequest,
  reply: FastifyReply,
  handler: (user: PublicUser, ctx: TenantContext) => Promise<unknown>,
): Promise<unknown> {
  const user = await requireAuth(request, reply);
  if (!user) return;

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

  const ctx: TenantContext = {
    userId: user.id,
    organizationId: project.organization_id,
    projectId: project.id,
  };
  request.tenant = ctx;

  return runWithTenantAsync(ctx, () => handler(user, ctx));
}

export function setAuthCookie(reply: FastifyReply, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header(
    'Set-Cookie',
    `growth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`,
  );
}

export function clearAuthCookie(reply: FastifyReply): void {
  reply.header(
    'Set-Cookie',
    'growth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  );
}
