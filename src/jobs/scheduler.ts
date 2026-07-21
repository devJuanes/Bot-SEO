import cron, { type ScheduledTask } from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import { env } from '../config/env.js';
import type { AgentId } from '../agents/types.js';
import { executeAgentAcrossProjects } from '../runtime/orchestrator.js';

interface ScheduledJob {
  agentId: AgentId;
  expression: string;
  task: ScheduledTask;
}

const jobs: ScheduledJob[] = [];

const cronMap: Array<{ agentId: AgentId; expression: string }> = [
  { agentId: 'lead-hunter', expression: env.CRON_LEAD_HUNTER },
  { agentId: 'opportunity-scout', expression: env.CRON_OPPORTUNITY_SCOUT },
  { agentId: 'infiltrator', expression: env.CRON_INFILTRATOR },
  { agentId: 'content-radar', expression: env.CRON_CONTENT_RADAR },
  { agentId: 'catalog-curator', expression: env.CRON_CATALOG_CURATOR },
  { agentId: 'editorial-planner', expression: env.CRON_EDITORIAL_PLANNER },
  { agentId: 'blog-writer', expression: env.CRON_BLOG_WRITER },
  { agentId: 'social-creator', expression: env.CRON_SOCIAL_CREATOR },
  { agentId: 'community-agent', expression: env.CRON_COMMUNITY_AGENT },
  { agentId: 'facebook-publisher', expression: env.CRON_FACEBOOK_PUBLISHER },
];

export function startScheduler(log: FastifyBaseLogger): void {
  for (const entry of cronMap) {
    if (!cron.validate(entry.expression)) {
      throw new Error(
        `Invalid cron expression for ${entry.agentId}: "${entry.expression}"`,
      );
    }

    const task = cron.schedule(entry.expression, async () => {
      log.info({ agentId: entry.agentId }, 'Cron triggered agent run (all projects)');
      try {
        const results = await executeAgentAcrossProjects(entry.agentId, log, 'cron');
        log.info({ agentId: entry.agentId, results }, 'Cron agent run finished');
      } catch (err) {
        log.error({ agentId: entry.agentId, err }, 'Cron agent run failed');
      }
    });

    jobs.push({
      agentId: entry.agentId,
      expression: entry.expression,
      task,
    });

    log.info(
      { agentId: entry.agentId, expression: entry.expression },
      'Scheduled agent cron',
    );
  }
}

export function stopScheduler(): void {
  for (const job of jobs) {
    job.task.stop();
  }
  jobs.length = 0;
}

export function listScheduledJobs(): Array<{
  agentId: AgentId;
  expression: string;
}> {
  return jobs.map(({ agentId, expression }) => ({ agentId, expression }));
}
