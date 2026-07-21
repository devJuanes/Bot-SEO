import type { FastifyInstance } from 'fastify';
import {
  countUnreadNotifications,
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../db/notifications.js';
import { requireAuth } from '../tenancy/auth.js';
import { getProject, assertOrgAccess } from '../tenancy/store.js';

async function assertProjectMember(projectId: string, userId: string) {
  const project = await getProject(projectId);
  if (!project) return { project: null, error: 'not_found' as const };
  try {
    await assertOrgAccess(project.organization_id, userId, 'member');
  } catch {
    return { project: null, error: 'forbidden' as const };
  }
  return { project, error: null };
}

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/projects/:projectId/notifications', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return reply.code(404).send({ error: 'No encontrado' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Prohibido' });

    const q = request.query as { unread?: string; limit?: string };
    const notifications = await listNotifications({
      projectId,
      userId: user.id,
      unreadOnly: q.unread === '1' || q.unread === 'true',
      limit: Number(q.limit ?? 40),
    });
    const unread = await countUnreadNotifications(projectId, user.id);
    return { notifications, unread };
  });

  app.post('/api/projects/:projectId/notifications/:id/read', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId, id } = request.params as { projectId: string; id: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return reply.code(404).send({ error: 'No encontrado' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Prohibido' });

    const row = await markNotificationRead(id, projectId);
    return { ok: true, notification: row };
  });

  app.post('/api/projects/:projectId/notifications/read-all', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return reply.code(404).send({ error: 'No encontrado' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Prohibido' });

    const count = await markAllNotificationsRead(projectId, user.id);
    return { ok: true, count };
  });

  /** Internal/test: create a notification for the project */
  app.post('/api/projects/:projectId/notifications', async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { projectId } = request.params as { projectId: string };
    const check = await assertProjectMember(projectId, user.id);
    if (check.error === 'not_found') return reply.code(404).send({ error: 'No encontrado' });
    if (check.error === 'forbidden') return reply.code(403).send({ error: 'Prohibido' });

    const body = (request.body ?? {}) as {
      title?: string;
      body?: string;
      type?: string;
      link?: string;
    };
    if (!body.title) return reply.code(400).send({ error: 'title es requerido' });

    const notification = await createNotification({
      projectId,
      organizationId: check.project!.organization_id,
      userId: user.id,
      title: body.title,
      body: body.body,
      type: body.type,
      link: body.link,
    });
    return { notification };
  });
}
