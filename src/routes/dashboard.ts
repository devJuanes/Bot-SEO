import type { FastifyInstance } from 'fastify';
import { getMatuByteSummary } from '../knowledge/matubyte.js';
import { peekHuntRotation } from '../runtime/hunt-rotation.js';
import {
  getAgentStates,
  getBusMessages,
  getLogs,
  onRuntimeEvent,
} from '../runtime/state.js';
import { countLeads, listRecentLeads, listRecentRuns } from '../db/leads.js';
import {
  listAppConnections,
  listBlogPosts,
  listContentScripts,
  listOpportunities,
  listPendingBriefs,
} from '../db/growth.js';
import { listScheduledJobs } from '../jobs/scheduler.js';
import { env } from '../config/env.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/dashboard', async () => {
    const [leads, runs, leadCount, opportunities, blogs, scripts, apps, briefs] =
      await Promise.all([
        listRecentLeads(40).catch(() => []),
        listRecentRuns(25).catch(() => []),
        countLeads().catch(() => 0),
        listOpportunities(30).catch(() => []),
        listBlogPosts(10).catch(() => []),
        listContentScripts(10).catch(() => []),
        listAppConnections().catch(() => []),
        listPendingBriefs(15).catch(() => []),
      ]);

    return {
      phase: 4,
      brand: getMatuByteSummary(),
      autopilot: {
        enabled: env.AUTO_START_AGENTS,
        delayMs: env.AUTO_START_DELAY_MS,
        huntIntervalMs: env.AUTO_HUNT_INTERVAL_MS,
        rotation: peekHuntRotation(),
      },
      agents: getAgentStates(),
      scheduledJobs: listScheduledJobs(),
      stats: {
        leadsApprox: leadCount,
        needsWebsite: leads.filter((l) => l.needs_website).length,
        opportunities: opportunities.length,
        blogs: blogs.length,
        scripts: scripts.length,
        apps: apps.length,
        pendingBriefs: briefs.length,
      },
      leads,
      opportunities,
      blogs,
      scripts,
      briefs,
      apps,
      runs,
      logs: getLogs(100),
      bus: getBusMessages(40),
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/api/events', async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('hello', { ok: true, ts: new Date().toISOString() });

    const offLog = onRuntimeEvent('log', (payload) => send('log', payload));
    const offAgent = onRuntimeEvent('agent', (payload) => send('agent', payload));
    const offMsg = onRuntimeEvent('message', (payload) => send('message', payload));

    const heartbeat = setInterval(() => {
      reply.raw.write(`: ping ${Date.now()}\n\n`);
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      offLog();
      offAgent();
      offMsg();
    });
  });
}
