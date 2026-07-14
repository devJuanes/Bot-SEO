import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from './config/env.js';
import { rootRoutes } from './routes/root.js';
import { healthRoutes } from './routes/health.js';
import { agentRoutes } from './routes/agents.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { growthApiRoutes } from './routes/growth-api.js';
import { whatsappWebhookRoutes } from './routes/whatsapp-webhook.js';
import { whatsappApiRoutes } from './routes/whatsapp-api.js';
import { facebookWebhookRoutes } from './routes/facebook-webhook.js';
import { adminPushRoutes } from './routes/admin-push.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';
import {
  bootstrapRuntime,
  startAutopilot,
} from './runtime/orchestrator.js';
import { seedAgentDefinitions, seedDefaultAppConnection } from './db/growth.js';
import { attachAdminSocket } from './realtime/admin-socket.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  app.removeContentTypeParser('application/json');
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body, done) => {
      const raw = typeof body === 'string' ? body : body.toString('utf8');
      // Kept raw for Meta's X-Hub-Signature-256 webhook verification.
      request.rawBody = raw;
      if (!raw || raw.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw) as unknown);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer' },
    (_request, body, done) => {
      done(null, body.length === 0 ? {} : body);
    },
  );

  await app.register(dashboardRoutes);
  await app.register(growthApiRoutes);
  await app.register(whatsappWebhookRoutes);
  await app.register(whatsappApiRoutes);
  await app.register(adminPushRoutes);

  if (env.FB_WEBHOOK_ENABLED) {
    await app.register(facebookWebhookRoutes);
    if (!env.META_APP_SECRET) {
      app.log.warn(
        'FB_WEBHOOK_ENABLED=true pero META_APP_SECRET no está seteado — las firmas de Meta NO se verificarán (acepta cualquier request).',
      );
    } else {
      app.log.info(
        `Webhook FB activo en /webhooks/facebook · verify_token=${env.FB_WEBHOOK_VERIFY_TOKEN}`,
      );
    }
  }
  await app.register(rootRoutes);
  await app.register(healthRoutes);
  await app.register(agentRoutes);

  await app.register(fastifyStatic, {
    root: join(__dirname, '..', 'public'),
    prefix: '/',
  });

  bootstrapRuntime();

  try {
    await seedAgentDefinitions();
    await seedDefaultAppConnection();
    app.log.info('Agent definitions + default app seeded in MatuDB');
  } catch (err) {
    app.log.warn({ err }, 'Could not seed MatuDB catalog (run npm run migrate)');
  }

  startScheduler(app.log);
  startAutopilot(app.log);

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down gracefully');
    stopScheduler();
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    attachAdminSocket(app.server);
    app.log.info(
      {
        port: env.PORT,
        llmProvider: env.LLM_PROVIDER,
        headlessMode: env.HEADLESS_MODE,
        autopilot: env.AUTO_START_AGENTS,
        cockpit: `http://127.0.0.1:${env.PORT}/`,
        adminPush: `ws://127.0.0.1:${env.PORT}/socket.io · admin:notify`,
      },
      'Growth Factory Phase 4 ready',
    );
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    stopScheduler();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
