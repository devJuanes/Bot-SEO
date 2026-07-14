import type { FastifyInstance } from 'fastify';
import {
  adminSocketStats,
  broadcastAdminNotify,
  type AdminNotifyChannel,
  type AdminNotifyPayload,
} from '../realtime/admin-socket.js';

export async function adminPushRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/push/status', async () => {
    return {
      ok: true,
      websocket: {
        path: '/socket.io',
        events: {
          hello: 'admin:hello',
          notify: 'admin:notify',
          subscribe: 'subscribe',
        },
        room: 'admin',
      },
      ...adminSocketStats(),
    };
  });

  app.post<{
    Body: {
      channel?: AdminNotifyChannel;
      title?: string;
      body?: string;
      tab?: AdminNotifyPayload['tab'];
      topic?: string;
      payload?: Record<string, unknown>;
    };
  }>('/api/admin/push', async (request) => {
    const channel = request.body?.channel ?? 'system';
    const title = String(request.body?.title ?? 'MatuSerch').slice(0, 120);
    const body = String(request.body?.body ?? 'Ping de prueba').slice(0, 500);
    const tab = request.body?.tab ?? 'settings';
    const topic = String(request.body?.topic ?? 'admin.test');

    const notify: AdminNotifyPayload = {
      type: 'notify',
      channel,
      topic,
      title,
      body,
      tab,
      payload: request.body?.payload,
      ts: new Date().toISOString(),
    };
    broadcastAdminNotify(notify);
    return { ok: true, delivered: adminSocketStats().clients, notify };
  });

  app.post('/api/admin/push/test', async () => {
    const notify: AdminNotifyPayload = {
      type: 'notify',
      channel: 'system',
      topic: 'admin.test',
      title: 'Push de prueba',
      body: 'WebSocket Growth → MatuSerch OK',
      tab: 'settings',
      ts: new Date().toISOString(),
    };
    broadcastAdminNotify(notify);
    return { ok: true, delivered: adminSocketStats().clients, notify };
  });
}
