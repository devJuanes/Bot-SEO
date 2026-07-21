import { db } from './matu.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

export interface NotificationRow {
  id: string;
  project_id: string;
  organization_id: string | null;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  meta: Record<string, unknown>;
  created_at: string;
}

export async function createNotification(input: {
  projectId: string;
  organizationId?: string | null;
  userId?: string | null;
  type?: string;
  title: string;
  body?: string | null;
  link?: string | null;
  meta?: Record<string, unknown>;
}): Promise<NotificationRow> {
  const { data, error } = await db.from('notifications').insert({
    project_id: input.projectId,
    organization_id: input.organizationId ?? null,
    user_id: input.userId ?? null,
    type: input.type ?? 'info',
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    is_read: false,
    meta: input.meta ?? {},
  });
  if (error) throw new Error(`createNotification: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as NotificationRow | undefined;
  if (!row) throw new Error('createNotification returned empty');
  return row;
}

export async function listNotifications(input: {
  projectId: string;
  userId?: string | null;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<NotificationRow[]> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 40));
  let q = db
    .from('notifications')
    .select('*')
    .eq('project_id', input.projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (input.unreadOnly) {
    q = q.eq('is_read', false);
  }

  const { data, error } = await q;
  if (error) throw new Error(`listNotifications: ${errMsg(error)}`);

  let rows = (data ?? []) as NotificationRow[];
  // Prefer user-scoped + project-wide (user_id null) notifications
  if (input.userId) {
    rows = rows.filter((r) => !r.user_id || r.user_id === input.userId);
  }
  return rows;
}

export async function countUnreadNotifications(
  projectId: string,
  userId?: string | null,
): Promise<number> {
  const rows = await listNotifications({
    projectId,
    userId,
    unreadOnly: true,
    limit: 100,
  });
  return rows.length;
}

export async function markNotificationRead(
  id: string,
  projectId: string,
): Promise<NotificationRow | null> {
  const { data, error } = await db
    .from('notifications')
    .eq('id', id)
    .eq('project_id', projectId)
    .update({ is_read: true });
  if (error) throw new Error(`markNotificationRead: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as NotificationRow | undefined;
  return row ?? null;
}

export async function markAllNotificationsRead(
  projectId: string,
  userId?: string | null,
): Promise<number> {
  const unread = await listNotifications({
    projectId,
    userId,
    unreadOnly: true,
    limit: 100,
  });
  let n = 0;
  for (const row of unread) {
    await markNotificationRead(row.id, projectId);
    n += 1;
  }
  return n;
}
