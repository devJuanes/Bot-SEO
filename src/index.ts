import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
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
import { authRoutes } from './routes/auth.js';
import { tenancyRoutes } from './routes/tenancy.js';
import { registerTenantGuard } from './tenancy/guard.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';
import {
  bootstrapRuntime,
  startAutopilot,
} from './runtime/orchestrator.js';
import { seedAgentDefinitions } from './db/growth.js';
import { attachAdminSocket } from './realtime/admin-socket.js';
import { leadsApiRoutes } from './routes/leads-api.js';
import { notificationsRoutes } from './routes/notifications-api.js';
import { saasApiRoutes } from './routes/saas-api.js';
import { registerSpaRoutes } from './routes/spa.js';

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

  await app.register(fastifyMultipart, {
    limits: {
      files: 1,
      fileSize: 100 * 1024 * 1024,
    },
  });

  await registerTenantGuard(app);
  await app.register(authRoutes);
  await app.register(tenancyRoutes);
  await app.register(dashboardRoutes);
  await app.register(leadsApiRoutes);
  await app.register(notificationsRoutes);
  await app.register(saasApiRoutes);
  await app.register(growthApiRoutes);
  await app.register(whatsappWebhookRoutes);
  await app.register(whatsappApiRoutes);
  await app.register(adminPushRoutes);

  if (env.FB_WEBHOOK_ENABLED) {
    await app.register(facebookWebhookRoutes);
    if (!env.META_APP_SECRET) {
      app.log.warn(
        'FB_WEBHOOK_ENABLED=true pero META_APP_SECRET no está seteado — las firmas de Meta NO se verificarán.',
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

  await registerSpaRoutes(app);

  bootstrapRuntime();

  try {
    await seedAgentDefinitions();
    app.log.info('Agent definitions seeded in MatuDB');
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
        login: `http://127.0.0.1:${env.PORT}/acceso/iniciar-sesion`,
        adminPush: `ws://127.0.0.1:${env.PORT}/socket.io · admin:notify`,
      },
      'Growth Factory SaaS ready',
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
