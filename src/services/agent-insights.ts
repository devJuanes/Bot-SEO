import { HUNT_SECTORS } from '../knowledge/matubyte.js';
import { listAgentRunsByAgent } from '../db/leads.js';
import { getCustomAgent } from '../db/custom-agents.js';
import { getProjectAgent } from '../db/project-agents.js';
import { getAgentDefinition } from '../db/growth.js';
import { getAgentState } from '../runtime/state.js';
import type { AgentId } from '../agents/types.js';
import { getLogs } from '../runtime/state.js';
import { getProjectSetting } from '../tenancy/store.js';
import type { BrandProfile } from '../services/brand-setup.js';
import { mergeLeadHunterConfig } from '../agents/config-defaults.js';
import { customAgentRunId } from '../agents/agent-ids.js';

export type AgentConfigProfile = 'lead-hunter' | 'catalog' | 'custom';

function runDurationMs(run: Record<string, unknown>): number {
  const start = run.started_at ? new Date(String(run.started_at)).getTime() : 0;
  const end = run.finished_at
    ? new Date(String(run.finished_at)).getTime()
    : run.created_at
      ? new Date(String(run.created_at)).getTime()
      : start;
  if (!start || !end || end < start) return 0;
  return end - start;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function aggregateRuns(runs: Record<string, unknown>[]) {
  let totalDurationMs = 0;
  let successRuns = 0;
  let errorRuns = 0;
  const byDay = new Map<string, { date: string; runs: number; success: number; errors: number }>();
  const byStatus = new Map<string, number>();
  const bySector = new Map<string, number>();

  for (const run of runs) {
    const status = String(run.status ?? 'unknown');
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    if (status === 'success' || status === 'ok') successRuns += 1;
    else if (status === 'error') errorRuns += 1;

    const ms = runDurationMs(run);
    totalDurationMs += ms;

    const ts = String(run.started_at ?? run.created_at ?? '');
    if (ts) {
      const key = dayKey(ts);
      const row = byDay.get(key) ?? { date: key, runs: 0, success: 0, errors: 0 };
      row.runs += 1;
      if (status === 'success' || status === 'ok') row.success += 1;
      if (status === 'error') row.errors += 1;
      byDay.set(key, row);
    }

    const details =
      run.details && typeof run.details === 'object'
        ? (run.details as Record<string, unknown>)
        : {};
    const sector = typeof details.sector === 'string' ? details.sector.trim() : '';
    if (sector) bySector.set(sector, (bySector.get(sector) ?? 0) + 1);
  }

  const activityByDay = [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const runsByStatus = [...byStatus.entries()].map(([status, count]) => ({
    status,
    count,
  }));

  const sectorHits = [...bySector.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const lastRun = runs[0] ?? null;

  return {
    totalDurationMs,
    successRuns,
    errorRuns,
    activityByDay,
    runsByStatus,
    sectorHits,
    lastRun,
    recentRuns: runs.slice(0, 20).map((run) => ({
      id: run.id,
      status: run.status,
      reason: run.reason,
      triggered_by: run.triggered_by,
      started_at: run.started_at,
      finished_at: run.finished_at,
      durationMs: runDurationMs(run),
      details: run.details ?? {},
    })),
    stats: {
      totalRuns: runs.length,
      successRuns,
      errorRuns,
      totalDurationMs,
      avgDurationMs: runs.length > 0 ? Math.round(totalDurationMs / runs.length) : 0,
      lastRunAt: lastRun ? String(lastRun.started_at ?? lastRun.created_at ?? '') : null,
    },
  };
}

export async function buildAgentInsights(projectId: string, agentId: string) {
  const [runs, projectAgent, profile, definition] = await Promise.all([
    listAgentRunsByAgent(agentId, 80),
    getProjectAgent(projectId, agentId),
    getProjectSetting<BrandProfile>(projectId, 'brand_profile'),
    getAgentDefinition(agentId),
  ]);

  const runtime = getAgentState(agentId as AgentId) ?? null;
  const rawConfig = (projectAgent?.config as Record<string, unknown>) ?? {};
  const config =
    agentId === 'lead-hunter'
      ? mergeLeadHunterConfig(rawConfig)
      : rawConfig;

  const agg = aggregateRuns(runs);
  const logs = getLogs(120).filter(
    (log) => !log.agentId || log.agentId === agentId,
  );

  const configProfile: AgentConfigProfile =
    agentId === 'lead-hunter' ? 'lead-hunter' : 'catalog';

  return {
    kind: 'catalog' as const,
    configProfile,
    agent: definition
      ? {
          id: definition.id,
          name: definition.name,
          role: definition.role,
          description: definition.description,
          capabilities: definition.capabilities,
        }
      : null,
    runtime,
    config,
    brand: {
      brand_name: profile?.brand_name ?? null,
      country: profile?.country ?? 'Colombia',
    },
    catalogSectors: HUNT_SECTORS,
    stats: {
      ...agg.stats,
      runtimeRunCount: runtime?.runCount ?? 0,
      runtimeSuccessCount: runtime?.successCount ?? 0,
      runtimeErrorCount: runtime?.errorCount ?? 0,
      lastDurationMs: runtime?.lastDurationMs ?? null,
    },
    activityByDay: agg.activityByDay,
    runsByStatus: agg.runsByStatus,
    sectorHits: agg.sectorHits,
    recentRuns: agg.recentRuns,
    logs: logs.slice(0, 60),
    is_enabled: projectAgent?.is_enabled ?? false,
  };
}

export async function buildCustomAgentInsights(projectId: string, customId: string) {
  const [agent, profile] = await Promise.all([
    getCustomAgent(projectId, customId),
    getProjectSetting<BrandProfile>(projectId, 'brand_profile'),
  ]);

  if (!agent) {
    throw new Error('Agente personalizado no encontrado');
  }

  const runKey = customAgentRunId(customId);
  const runs = await listAgentRunsByAgent(runKey, 80);
  const agg = aggregateRuns(runs);
  const logs = getLogs(120).filter(
    (log) => log.agentId === runKey || log.agentId === customId,
  );

  return {
    kind: 'custom' as const,
    configProfile: 'custom' as const,
    agent: {
      id: agent.id,
      name: agent.name,
      role: 'custom',
      description: agent.goal,
      capabilities: ['llm', 'brand_context'],
      goal: agent.goal,
      system_prompt: agent.system_prompt,
      schedule_hint: agent.schedule_hint,
      last_run_summary: agent.last_run_summary,
      last_run_status: agent.last_run_status,
      last_run_at: agent.last_run_at,
    },
    runtime: null,
    config: (agent.config as Record<string, unknown>) ?? {},
    brand: {
      brand_name: profile?.brand_name ?? null,
      country: profile?.country ?? 'Colombia',
    },
    catalogSectors: HUNT_SECTORS,
    stats: {
      ...agg.stats,
      runtimeRunCount: agg.stats.totalRuns,
      runtimeSuccessCount: agg.stats.successRuns,
      runtimeErrorCount: agg.stats.errorRuns,
      lastDurationMs: agg.recentRuns[0]?.durationMs ?? null,
    },
    activityByDay: agg.activityByDay,
    runsByStatus: agg.runsByStatus,
    sectorHits: agg.sectorHits,
    recentRuns: agg.recentRuns,
    logs: logs.slice(0, 60),
    is_enabled: agent.is_enabled,
  };
}
