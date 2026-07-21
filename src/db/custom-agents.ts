import { db } from './matu.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import { getProjectSetting } from '../tenancy/store.js';
import { logAgentRun } from './leads.js';
import { customAgentRunId } from '../agents/agent-ids.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

export interface CustomAgentRow {
  id: string;
  project_id: string;
  organization_id: string | null;
  name: string;
  goal: string;
  system_prompt: string | null;
  schedule_hint: string | null;
  is_enabled: boolean;
  autopilot_enabled: boolean;
  config: Record<string, unknown>;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_summary: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCustomAgents(
  projectId: string,
): Promise<CustomAgentRow[]> {
  const { data, error } = await db
    .from('custom_agents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listCustomAgents: ${errMsg(error)}`);
  return (data ?? []) as CustomAgentRow[];
}

export async function getCustomAgent(
  projectId: string,
  id: string,
): Promise<CustomAgentRow | null> {
  const { data, error } = await db
    .from('custom_agents')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', id)
    .limit(1);
  if (error) throw new Error(`getCustomAgent: ${errMsg(error)}`);
  return ((data ?? [])[0] as CustomAgentRow | undefined) ?? null;
}

export async function createCustomAgent(input: {
  projectId: string;
  organizationId?: string | null;
  name: string;
  goal: string;
  systemPrompt?: string;
  scheduleHint?: string;
  config?: Record<string, unknown>;
}): Promise<CustomAgentRow> {
  const { data, error } = await db.from('custom_agents').insert({
    project_id: input.projectId,
    organization_id: input.organizationId ?? null,
    name: input.name.trim(),
    goal: input.goal.trim(),
    system_prompt: input.systemPrompt?.trim() || null,
    schedule_hint: input.scheduleHint?.trim() || null,
    is_enabled: true,
    autopilot_enabled: true,
    config: input.config ?? {},
  });
  if (error) throw new Error(`createCustomAgent: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as CustomAgentRow | undefined;
  if (!row) throw new Error('createCustomAgent returned empty');
  return row;
}

export async function updateCustomAgent(
  projectId: string,
  id: string,
  patch: Partial<{
    name: string;
    goal: string;
    system_prompt: string | null;
    schedule_hint: string | null;
    is_enabled: boolean;
    autopilot_enabled: boolean;
    config: Record<string, unknown>;
    last_run_at: string | null;
    last_run_status: string | null;
    last_run_summary: string | null;
  }>,
): Promise<CustomAgentRow> {
  const { data, error } = await db
    .from('custom_agents')
    .eq('id', id)
    .eq('project_id', projectId)
    .update({ ...patch, updated_at: new Date().toISOString() });
  if (error) throw new Error(`updateCustomAgent: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as CustomAgentRow | undefined;
  if (row) return row;
  const fresh = await getCustomAgent(projectId, id);
  if (!fresh) throw new Error('updateCustomAgent: not found');
  return fresh;
}

export async function deleteCustomAgent(
  projectId: string,
  id: string,
): Promise<void> {
  const { error } = await db
    .from('custom_agents')
    .eq('project_id', projectId)
    .eq('id', id)
    .delete();
  if (error) throw new Error(`deleteCustomAgent: ${errMsg(error)}`);
}

/**
 * Runs a custom agent via LLM with brand context.
 * Limitation: does not scrape external sources yet — produces a structured action plan / findings text.
 */
export async function runCustomAgent(
  projectId: string,
  id: string,
): Promise<{ summary: string; status: string }> {
  const agent = await getCustomAgent(projectId, id);
  if (!agent) throw new Error('Agente personalizado no encontrado');
  if (!agent.is_enabled) throw new Error('El agente está desactivado');

  if (!(await isLlmConfigured())) {
    throw new Error('LLM no configurado. Configúralo en Ajustes → LLM / IA.');
  }

  const brandName = (await getProjectSetting<string>(projectId, 'brand_name')) ?? '';
  const brandKnowledge =
    (await getProjectSetting<string>(projectId, 'brand_knowledge')) ?? '';
  const huntSources =
    (await getProjectSetting<Record<string, unknown>>(projectId, 'hunt_sources')) ??
    {};

  const startedAt = new Date().toISOString();
  const system =
    agent.system_prompt?.trim() ||
    `Eres un agente de growth personalizado para ${brandName || 'la empresa'}. ` +
      `Trabajas en español. Ejecutas el objetivo del usuario y propones acciones concretas.`;

  try {
    const completion = await chatCompletion({
      temperature: 0.6,
      maxTokens: 1200,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Objetivo del agente: ${agent.goal}

Marca: ${brandName || '(sin nombre)'}
Conocimiento de marca:
${brandKnowledge.slice(0, 4000) || '(sin configurar)'}

Fuentes de caza configuradas (JSON): ${JSON.stringify(huntSources)}
Config del agente: ${JSON.stringify(agent.config ?? {})}

Produce un resumen ejecutivo en español con:
1) Hallazgos / hipótesis
2) Acciones recomendadas (máx 5)
3) Próximo paso inmediato
Nota: aún no tienes scrapers propios; razona con el contexto disponible.`,
        },
      ],
    });

    const summary = completion.content.trim();
    const finishedAt = new Date().toISOString();
    await updateCustomAgent(projectId, id, {
      last_run_at: finishedAt,
      last_run_status: 'ok',
      last_run_summary: summary.slice(0, 4000),
    });

    await logAgentRun({
      agent_id: customAgentRunId(id),
      triggered_by: 'auto',
      status: 'ok',
      reason: summary.slice(0, 280),
      started_at: startedAt,
      finished_at: finishedAt,
      details: { type: 'custom_agent' },
    }).catch(() => undefined);

    return { summary, status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAgentRun({
      agent_id: customAgentRunId(id),
      triggered_by: 'auto',
      status: 'error',
      reason: message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    }).catch(() => undefined);
    throw err;
  }
}

/** Agent IDs that require projects.content_enabled (or features.blogs). */
export const CONTENT_GATED_AGENT_IDS = new Set([
  'content-radar',
  'catalog-curator',
  'editorial-planner',
  'blog-writer',
  'social-creator',
  'community-agent',
]);

export function isContentGatedAgent(agentId: string): boolean {
  return CONTENT_GATED_AGENT_IDS.has(agentId);
}
