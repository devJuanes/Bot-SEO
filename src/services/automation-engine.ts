import type { Lead } from '../db/types.js';
import { getLeadById, updateLeadStatus } from '../db/leads.js';
import {
  listRulesByTrigger,
  logAutomationRun,
  type AutomationAction,
  type AutomationCondition,
  type AutomationRule,
} from '../db/automation.js';
import { createNotification } from '../db/notifications.js';
import { scheduleProjectAgentRun } from '../runtime/orchestrator.js';
import { sendAgentMessage } from '../runtime/state.js';
import { requireProjectId } from '../tenancy/context.js';
import type { FastifyBaseLogger } from 'fastify';

const noopLog = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as FastifyBaseLogger;

export type AutomationTriggerPayload = {
  leadId?: string;
  lead?: Lead;
  fromStatus?: string | null;
  toStatus?: string;
  agentId?: string;
  agentStatus?: string;
  waId?: string;
  text?: string;
  messageType?: string;
  conversationId?: string;
};

function matchesTriggerConfig(
  rule: AutomationRule,
  payload: AutomationTriggerPayload,
): boolean {
  const cfg = rule.trigger_config ?? {};
  if (rule.trigger_type === 'lead.status_changed') {
    const to = cfg.to_status as string | undefined;
    const from = cfg.from_status as string | undefined;
    if (to && payload.toStatus !== to) return false;
    if (from && payload.fromStatus !== from) return false;
  }
  if (rule.trigger_type === 'agent.run.completed' || rule.trigger_type === 'agent.run.started') {
    const agentId = cfg.agent_id as string | undefined;
    const status = cfg.status as string | undefined;
    if (agentId && payload.agentId !== agentId) return false;
    if (status && payload.agentStatus !== status) return false;
  }
  if (rule.trigger_type === 'whatsapp.message_received') {
    const keyword = cfg.keyword as string | undefined;
    const messageType = cfg.message_type as string | undefined;
    if (keyword) {
      const hay = String(payload.text ?? '').toLowerCase();
      if (!hay.includes(keyword.toLowerCase())) return false;
    }
    if (messageType && messageType !== 'any' && payload.messageType !== messageType) {
      return false;
    }
  }
  return true;
}

function evalCondition(cond: AutomationCondition, lead: Lead | null): boolean {
  if (!lead) return false;
  const raw = (lead as unknown as Record<string, unknown>)[cond.field];
  switch (cond.op) {
    case 'eq':
      return String(raw) === String(cond.value);
    case 'neq':
      return String(raw) !== String(cond.value);
    case 'contains':
      return String(raw ?? '')
        .toLowerCase()
        .includes(String(cond.value ?? '').toLowerCase());
    case 'truthy':
      return Boolean(raw);
    default:
      return false;
  }
}

function matchesConditions(
  rule: AutomationRule,
  lead: Lead | null,
  triggerType: string,
): boolean {
  const conditions = rule.conditions ?? [];
  if (conditions.length === 0) return true;
  if (!lead) {
    return triggerType === 'whatsapp.message_received' || triggerType.startsWith('agent.run.');
  }
  return conditions.every((c: AutomationCondition) => evalCondition(c, lead));
}

async function runAction(
  action: AutomationAction,
  lead: Lead | null,
  log: FastifyBaseLogger,
): Promise<{ ok: boolean; detail?: string; error?: string }> {
  const projectId = requireProjectId();
  try {
    switch (action.type) {
      case 'update_lead_status': {
        const status = String(action.config.status ?? '');
        if (!lead || !status) return { ok: false, error: 'missing lead or status' };
        await updateLeadStatus(lead.id, status, {
          changedBy: 'automation',
          reason: 'automation action',
          skipAutomation: true,
        });
        return { ok: true, detail: `status → ${status}` };
      }
      case 'create_notification': {
        await createNotification({
          projectId,
          type: 'automation',
          title: String(action.config.title ?? 'Automatización ejecutada'),
          body: action.config.body ? String(action.config.body) : null,
          link: action.config.link ? String(action.config.link) : null,
          meta: { leadId: lead?.id },
        });
        return { ok: true, detail: 'notification created' };
      }
      case 'run_agent': {
        const agentId = String(action.config.agentId ?? '');
        if (!agentId) return { ok: false, error: 'missing agentId' };
        scheduleProjectAgentRun(projectId, agentId, log);
        return { ok: true, detail: `agent ${agentId} scheduled` };
      }
      default:
        return { ok: false, error: `unknown action ${action.type}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function dispatchAutomationTrigger(
  triggerType: string,
  payload: AutomationTriggerPayload,
  log: FastifyBaseLogger = noopLog,
): Promise<void> {
  let rules: AutomationRule[];
  try {
    rules = await listRulesByTrigger(triggerType);
  } catch {
    return;
  }

  let lead = payload.lead ?? null;
  if (!lead && payload.leadId) {
    lead = await getLeadById(payload.leadId);
  }

  for (const rule of rules) {
    if (!matchesTriggerConfig(rule, payload)) {
      await logAutomationRun({
        ruleId: rule.id,
        status: 'skipped',
        triggerPayload: payload as Record<string, unknown>,
        actionsResult: [{ reason: 'trigger_config mismatch' }],
      });
      continue;
    }
    if (!matchesConditions(rule, lead, triggerType)) {
      await logAutomationRun({
        ruleId: rule.id,
        status: 'skipped',
        triggerPayload: payload as Record<string, unknown>,
        actionsResult: [{ reason: 'conditions not met' }],
      });
      continue;
    }

    const results: unknown[] = [];
    let failed = false;
    for (const action of rule.actions ?? []) {
      const result = await runAction(action, lead, log);
      results.push({ type: action.type, ...result });
      if (!result.ok) failed = true;
    }

    await logAutomationRun({
      ruleId: rule.id,
      status: failed ? 'error' : 'ok',
      triggerPayload: payload as Record<string, unknown>,
      actionsResult: results,
      error: failed ? 'one or more actions failed' : null,
    });

    sendAgentMessage({
      from: 'orchestrator',
      to: 'broadcast',
      topic: 'automation.executed',
      body: `Regla "${rule.name}" ejecutada`,
      payload: { ruleId: rule.id, triggerType, failed },
    });
  }
}

export const AUTOMATION_TEMPLATES = [
  {
    id: 'new-lead-notify',
    name: 'Nuevo lead → notificación',
    trigger_type: 'lead.created',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        type: 'create_notification' as const,
        config: {
          title: 'Nuevo lead detectado',
          body: 'Un agente encontró un prospecto nuevo en tu pipeline.',
          link: '/leads',
        },
      },
    ],
  },
  {
    id: 'qualified-run-agent',
    name: 'Calificado → ejecutar agente',
    trigger_type: 'lead.status_changed',
    trigger_config: { to_status: 'qualified' },
    conditions: [],
    actions: [
      {
        type: 'create_notification' as const,
        config: {
          title: 'Lead calificado',
          body: 'Un lead pasó a Calificado. Revisa el pipeline.',
          link: '/leads',
        },
      },
    ],
  },
  {
    id: 'new-contacted',
    name: 'Nuevo → Contactado automático (WA)',
    trigger_type: 'lead.status_changed',
    trigger_config: { from_status: 'new', to_status: 'contacted' },
    conditions: [{ field: 'needs_website', op: 'truthy' as const }],
    actions: [
      {
        type: 'create_notification' as const,
        config: {
          title: 'Lead sin web contactado',
          body: 'Oportunidad caliente: negocio sin web en contacto.',
          link: '/leads',
        },
      },
    ],
  },
  {
    id: 'hunter-done-notify',
    name: 'Lead Hunter terminó → notificar',
    trigger_type: 'agent.run.completed',
    trigger_config: { agent_id: 'lead-hunter', status: 'success' },
    conditions: [],
    actions: [
      {
        type: 'create_notification' as const,
        config: {
          title: 'Lead Hunter completó búsqueda',
          body: 'Revisa los nuevos prospectos en el tablero.',
          link: '/leads',
        },
      },
    ],
  },
];
