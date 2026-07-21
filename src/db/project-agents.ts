import { db } from './matu.js';
import {
  getAgentDefinition,
  listAgentDefinitions,
  type AgentDefinition,
} from './growth.js';
import { defaultAgentConfig } from '../agents/config-defaults.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

export interface ProjectAgentRow {
  id: string;
  project_id: string;
  agent_id: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  autopilot_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectAgentView extends AgentDefinition {
  projectAgentId: string;
  is_enabled: boolean;
  autopilot_enabled: boolean;
  config: Record<string, unknown>;
}

export async function listProjectAgents(
  projectId: string,
): Promise<ProjectAgentRow[]> {
  const { data, error } = await db
    .from('project_agents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listProjectAgents: ${errMsg(error)}`);
  return (data ?? []) as ProjectAgentRow[];
}

export async function listEnabledProjectAgents(
  projectId: string,
): Promise<ProjectAgentRow[]> {
  const { data, error } = await db
    .from('project_agents')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_enabled', true)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listEnabledProjectAgents: ${errMsg(error)}`);
  return (data ?? []) as ProjectAgentRow[];
}

export async function getProjectAgent(
  projectId: string,
  agentId: string,
): Promise<ProjectAgentRow | null> {
  const { data, error } = await db
    .from('project_agents')
    .select('*')
    .eq('project_id', projectId)
    .eq('agent_id', agentId)
    .limit(1);
  if (error) throw new Error(`getProjectAgent: ${errMsg(error)}`);
  return ((data ?? [])[0] as ProjectAgentRow | undefined) ?? null;
}

export async function isAgentEnabledForProject(
  projectId: string,
  agentId: string,
): Promise<boolean> {
  const row = await getProjectAgent(projectId, agentId);
  return Boolean(row?.is_enabled);
}

export async function addProjectAgent(
  projectId: string,
  agentId: string,
): Promise<ProjectAgentRow> {
  const def = await getAgentDefinition(agentId);
  if (!def) throw new Error(`Agent not found in catalog: ${agentId}`);

  const existing = await getProjectAgent(projectId, agentId);
  if (existing) {
    if (!existing.is_enabled) {
      const { data, error } = await db
        .from('project_agents')
        .eq('id', existing.id)
        .update({
          is_enabled: true,
          autopilot_enabled: true,
          updated_at: new Date().toISOString(),
        });
      if (error) throw new Error(`addProjectAgent enable: ${errMsg(error)}`);
      const row = (Array.isArray(data) ? data[0] : data) as
        | ProjectAgentRow
        | undefined;
      if (row) return row;
      const fresh = await getProjectAgent(projectId, agentId);
      if (!fresh) throw new Error('addProjectAgent: row missing after enable');
      return fresh;
    }
    return existing;
  }

  const { data, error } = await db.from('project_agents').insert({
    project_id: projectId,
    agent_id: agentId,
    is_enabled: true,
    autopilot_enabled: true,
    config: await defaultAgentConfig(projectId, agentId),
  });
  if (error) throw new Error(`addProjectAgent: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as ProjectAgentRow | undefined;
  if (!row) throw new Error('addProjectAgent returned empty');
  return row;
}

export async function updateProjectAgent(
  projectId: string,
  agentId: string,
  patch: Partial<{
    is_enabled: boolean;
    autopilot_enabled: boolean;
    config: Record<string, unknown>;
  }>,
): Promise<ProjectAgentRow> {
  const existing = await getProjectAgent(projectId, agentId);
  if (!existing) throw new Error('Agent not added to this project');

  const { data, error } = await db
    .from('project_agents')
    .eq('id', existing.id)
    .update({ ...patch, updated_at: new Date().toISOString() });
  if (error) throw new Error(`updateProjectAgent: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as ProjectAgentRow | undefined;
  if (row) return row;
  const fresh = await getProjectAgent(projectId, agentId);
  if (!fresh) throw new Error('updateProjectAgent: row missing');
  return fresh;
}

export async function removeProjectAgent(
  projectId: string,
  agentId: string,
): Promise<void> {
  const { error } = await db
    .from('project_agents')
    .eq('project_id', projectId)
    .eq('agent_id', agentId)
    .delete();
  if (error) throw new Error(`removeProjectAgent: ${errMsg(error)}`);
}

async function mergeAgentViews(
  rows: ProjectAgentRow[],
): Promise<ProjectAgentView[]> {
  const views: ProjectAgentView[] = [];
  for (const row of rows) {
    const def = await getAgentDefinition(row.agent_id);
    if (!def) continue;
    views.push({
      ...def,
      projectAgentId: row.id,
      is_enabled: row.is_enabled,
      autopilot_enabled: row.autopilot_enabled,
      config: (row.config as Record<string, unknown>) ?? {},
    });
  }
  return views;
}

export async function listProjectAgentViews(
  projectId: string,
  enabledOnly = false,
): Promise<ProjectAgentView[]> {
  const rows = enabledOnly
    ? await listEnabledProjectAgents(projectId)
    : await listProjectAgents(projectId);
  return mergeAgentViews(rows);
}

export async function listProjectAgentCatalog(
  projectId: string,
): Promise<
  Array<
    AgentDefinition & {
      added: boolean;
      is_enabled: boolean;
      autopilot_enabled: boolean;
      projectAgentId: string | null;
      config: Record<string, unknown>;
    }
  >
> {
  const [catalog, projectRows] = await Promise.all([
    listAgentDefinitions(),
    listProjectAgents(projectId),
  ]);
  const byAgent = new Map(projectRows.map((r) => [r.agent_id, r]));

  return catalog.map((def) => {
    const row = byAgent.get(def.id);
    return {
      ...def,
      added: Boolean(row),
      is_enabled: row?.is_enabled ?? false,
      autopilot_enabled: row?.autopilot_enabled ?? false,
      projectAgentId: row?.id ?? null,
      config: (row?.config as Record<string, unknown>) ?? {},
    };
  });
}

export async function listAutopilotAgentIdsForProject(
  projectId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from('project_agents')
    .select('agent_id')
    .eq('project_id', projectId)
    .eq('is_enabled', true)
    .eq('autopilot_enabled', true);
  if (error) {
    throw new Error(`listAutopilotAgentIdsForProject: ${errMsg(error)}`);
  }
  return ((data ?? []) as Array<{ agent_id: string }>).map((r) => r.agent_id);
}
