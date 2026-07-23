import type { FastifyInstance } from 'fastify';
import {
  authenticateUser,
  createSession,
  createUser,
  listOrganizationsForUser,
  listProjects,
  revokeSessionByJwt,
} from '../tenancy/store.js';
import { registerWithInvitation } from '../services/billing.js';
import {
  clearAuthCookie,
  extractBearerToken,
  requireAuth,
  setAuthCookie,
} from '../tenancy/auth.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', async (request, reply) => {
    const body = (request.body ?? {}) as {
      email?: string;
      password?: string;
      name?: string;
      organizationName?: string;
      projectName?: string;
      invitationCode?: string;
    };

    if (!body.email || !body.password || !body.name) {
      return reply.code(400).send({
        error: 'email, password and name are required',
      });
    }
    if (body.password.length < 8) {
      return reply.code(400).send({ error: 'password must be at least 8 characters' });
    }

    if (!body.invitationCode?.trim()) {
      return reply.code(402).send({
        error: 'Se requiere código de invitación o pago del plan Pro',
        requiresPayment: true,
        plan: 'plan-pro',
        amount: 50000,
        currency: 'COP',
      });
    }

    try {
      const result = await registerWithInvitation({
        email: body.email,
        password: body.password,
        name: body.name,
        organizationName: body.organizationName,
        projectName: body.projectName,
        invitationCode: body.invitationCode,
      });
      setAuthCookie(reply, result.token);
      return {
        user: result.user,
        organization: result.organization,
        project: result.project,
        token: result.token,
        plan: result.plan,
        vip: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/unique|duplicate|already/i.test(message)) {
        return reply.code(409).send({ error: 'Email already registered' });
      }
      request.log.error({ err }, 'register failed');
      return reply.code(500).send({ error: message });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = (request.body ?? {}) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return reply.code(400).send({ error: 'email and password are required' });
    }

    const user = await authenticateUser(body.email, body.password);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const session = await createSession(user.id);
    setAuthCookie(reply, session.token);

    const orgs = await listOrganizationsForUser(user.id);
    const projects =
      orgs.length > 0 ? await listProjects(orgs[0]!.id) : [];

    return {
      user,
      organizations: orgs,
      projects,
      token: session.token,
    };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = extractBearerToken(request);
    if (token) {
      await revokeSessionByJwt(token).catch(() => undefined);
    }
    clearAuthCookie(reply);
    return { ok: true };
  });

  app.get('/api/auth/me', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const orgs = await listOrganizationsForUser(user.id);
    const projectsByOrg: Record<string, unknown[]> = {};
    for (const org of orgs) {
      projectsByOrg[org.id] = await listProjects(org.id);
    }

    return { user, organizations: orgs, projectsByOrg };
  });

  // Lightweight create-user without bootstrap (for invites later)
  app.post('/api/auth/users', async (request, reply) => {
    const body = (request.body ?? {}) as {
      email?: string;
      password?: string;
      name?: string;
    };
    if (!body.email || !body.password || !body.name) {
      return reply.code(400).send({ error: 'email, password and name required' });
    }
    try {
      const user = await createUser({
        email: body.email,
        password: body.password,
        name: body.name,
      });
      return { user };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }
  });
}
