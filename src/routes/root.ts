import type { FastifyInstance } from 'fastify';

export async function rootRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api', async () => {
    return {
      service: 'matubyte-growth-factory',
      company: 'MatuByte S.A.S.',
      phase: 4,
      message: 'Fábrica de Growth API',
      endpoints: {
        health: 'GET /health',
        dashboard: 'GET /api/dashboard',
        events: 'GET /api/events',
        adminPushStatus: 'GET /api/admin/push/status',
        adminPush: 'POST /api/admin/push',
        adminPushTest: 'POST /api/admin/push/test',
        adminSocket: 'WebSocket /socket.io → events admin:notify',
        agents: 'GET /agents',
        runAgent: 'POST /agents/:id/run',
      },
      agents: [
        'lead-hunter',
        'infiltrator',
        'content-radar',
        'blog-writer',
      ],
    };
  });
}
