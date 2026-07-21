import type { FastifyInstance } from 'fastify';
import { pingDatabase } from '../db/matu.js';
import { isLlmConfiguredSync } from '../llm/client.js';
import { env } from '../config/env.js';
import { listScheduledJobs } from '../jobs/scheduler.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const dbPing = await pingDatabase();

    return {
      status: dbPing.ok ? 'ok' : 'degraded',
      service: 'matubyte-growth-factory',
      phase: 4,
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
      checks: {
        db: dbPing.ok ? 'ok' : 'error',
        dbError: dbPing.error,
        llm: isLlmConfiguredSync() ? 'configured' : 'missing',
        headlessMode: env.HEADLESS_MODE,
        scheduledJobs: listScheduledJobs(),
      },
    };
  });
}
