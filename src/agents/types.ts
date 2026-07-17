import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.js';

export type AgentId =
  | 'lead-hunter'
  | 'opportunity-scout'
  | 'infiltrator'
  | 'content-radar'
  | 'blog-writer'
  | 'social-creator'
  | 'community-agent'
  | 'facebook-publisher'
  | 'catalog-curator'
  | 'editorial-planner';

export type AgentRunStatus = 'ok' | 'skipped' | 'error';

export interface AgentResult {
  status: AgentRunStatus;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface AgentContext {
  env: Env;
  log: FastifyBaseLogger;
  triggeredBy: 'cron' | 'manual';
  params?: Record<string, unknown>;
}

export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  run: (ctx: AgentContext) => Promise<AgentResult>;
}
