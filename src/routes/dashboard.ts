import type { FastifyInstance } from 'fastify';
import type { AgentId } from '../agents/types.js';
import { getMatuByteSummary } from '../knowledge/matubyte.js';
import { peekHuntRotation } from '../runtime/hunt-rotation.js';
import {
  getAgentState,
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
import { listProjectAgentViews } from '../db/project-agents.js';
import { listScheduledJobs } from '../jobs/scheduler.js';
import { env } from '../config/env.js';
import { getProjectIdFromRequest } from '../tenancy/auth.js';
import { getProject } from '../tenancy/store.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/dashboard', async (request) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    const projectId = request.tenant?.projectId;

    return withRequestTenant(request.tenant, async () => {
      const [
        leads,
        runs,
        leadCount,
        opportunities,
        blogs,
        scripts,
        apps,
        briefs,
        project,
        projectAgents,
      ] = await Promise.all([
        listRecentLeads(40),
        listRecentRuns(25),
        countLeads(),
        listOpportunities(30),
        listBlogPosts(10),
        listContentScripts(10),
        listAppConnections(),
        listPendingBriefs(15),
        projectId ? getProject(projectId) : Promise.resolve(null),
        projectId ? listProjectAgentViews(projectId, true) : Promise.resolve([]),
      ]);

      const agents = projectAgents.map((def) => {
        const runtime = getAgentState(def.id as AgentId) ?? {
          status: 'idle',
          runCount: 0,
          successCount: 0,
          errorCount: 0,
        };
        return {
          ...runtime,
          id: def.id,
          name: def.name,
          role: def.role,
          description: def.description,
          is_enabled: def.is_enabled,
          autopilot_enabled: def.autopilot_enabled,
          config: def.config,
        };
      });

      return {
        brand: getMatuByteSummary(),
        project: project
          ? {
              id: project.id,
              name: project.name,
              autopilot_enabled: project.autopilot_enabled,
            }
          : null,
        autopilot: {
          enabled: project?.autopilot_enabled ?? false,
          delayMs: env.AUTO_START_DELAY_MS,
          huntIntervalMs: env.AUTO_HUNT_INTERVAL_MS,
          rotation: peekHuntRotation(),
        },
        agents,
        scheduledJobs: listScheduledJobs(),
        stats: {
          leadsApprox: leadCount,
          needsWebsite: leads.filter((l) => l.needs_website).length,
          opportunities: opportunities.length,
          blogs: blogs.length,
          scripts: scripts.length,
          apps: apps.length,
          pendingBriefs: briefs.length,
          agentsEnabled: projectAgents.length,
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
  });

  app.get('/api/events', async (request, reply) => {
    const projectId =
      getProjectIdFromRequest(request) || request.tenant?.projectId;
    if (!projectId) {
      return reply.code(400).send({
        error: 'Missing X-Project-Id header (or ?projectId=)',
      });
    }

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
    const offAgent = onRuntimeEvent('agent', (payload) =>
      send('agent', payload),
    );
    const offMsg = onRuntimeEvent('message', (payload) =>
      send('message', payload),
    );

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
