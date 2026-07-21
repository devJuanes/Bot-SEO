import { db } from './matu.js';
import { requireProjectId, tenantInsertFields } from '../tenancy/context.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

/** MatuDB REST insert expects JSON/JSONB columns as JSON strings. */
function toJsonColumn(value: unknown, fallback: Record<string, unknown> = {}): string {
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(fallback);
    }
  }
  return JSON.stringify(value ?? fallback);
}

function toJsonArrayColumn(value: unknown): string {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(Array.isArray(parsed) ? parsed : []);
    } catch {
      return '[]';
    }
  }
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') return value as T;
  return fallback;
}

function normalizeRule(row: AutomationRule): AutomationRule {
  return {
    ...row,
    trigger_config: parseJsonField(row.trigger_config, {}),
    conditions: parseJsonField(row.conditions, []),
    actions: parseJsonField(row.actions, []),
  };
}

export type AutomationTriggerType =
  | 'lead.created'
  | 'lead.status_changed'
  | 'agent.run.completed';

export interface AutomationCondition {
  field: string;
  op: 'eq' | 'neq' | 'contains' | 'truthy';
  value?: string | boolean | number;
}

export interface AutomationAction {
  type: 'update_lead_status' | 'create_notification' | 'run_agent';
  config: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  project_id: string;
  organization_id: string | null;
  name: string;
  is_enabled: boolean;
  trigger_type: AutomationTriggerType | string;
  trigger_config: Record<string, unknown>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  last_run_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  rule_id: string;
  project_id: string;
  status: string;
  trigger_payload: Record<string, unknown>;
  actions_result: unknown[];
  error: string | null;
  created_at: string;
}

function scopedRules() {
  return db.from('automation_rules').eq('project_id', requireProjectId());
}

export async function listAutomationRules(): Promise<AutomationRule[]> {
  const { data, error } = await scopedRules().order('created_at', { ascending: false });
  if (error) throw new Error(`listAutomationRules: ${errMsg(error)}`);
  return ((data ?? []) as AutomationRule[]).map(normalizeRule);
}

export async function getAutomationRule(id: string): Promise<AutomationRule | null> {
  const { data, error } = await scopedRules().eq('id', id).limit(1);
  if (error) throw new Error(`getAutomationRule: ${errMsg(error)}`);
  const row = ((data ?? [])[0] as AutomationRule | undefined) ?? null;
  return row ? normalizeRule(row) : null;
}

export async function createAutomationRule(input: {
  name: string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  is_enabled?: boolean;
}): Promise<AutomationRule> {
  const tenant = tenantInsertFields();
  const name = input.name.trim();
  const payload = {
    name,
    trigger_type: input.trigger_type,
    trigger_config: toJsonColumn(input.trigger_config, {}),
    conditions: toJsonArrayColumn(input.conditions ?? []),
    actions: toJsonArrayColumn(input.actions),
    is_enabled: input.is_enabled !== false,
    ...tenant,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db.from('automation_rules').insert(payload);
  if (error) {
    const msg = errMsg(error);
    if (
      msg.toLowerCase().includes('automation_rules') ||
      msg.toLowerCase().includes('does not exist') ||
      msg.toLowerCase().includes('not found')
    ) {
      throw new Error(
        'Tabla automation_rules no existe. Ejecuta npm run migrate y recarga.',
      );
    }
    throw new Error(`createAutomationRule: ${msg}`);
  }

  const inserted = Array.isArray(data) ? data[0] : data;
  if (inserted && typeof inserted === 'object' && 'id' in inserted) {
    return normalizeRule(inserted as AutomationRule);
  }

  const { data: fetched, error: fetchError } = await scopedRules()
    .eq('name', name)
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchError) {
    throw new Error(`createAutomationRule: insert ok but fetch failed: ${errMsg(fetchError)}`);
  }

  const row = Array.isArray(fetched) ? fetched[0] : fetched;
  if (!row) {
    throw new Error(
      'No se pudo crear la regla. Verifica que npm run migrate se ejecutó correctamente.',
    );
  }
  return normalizeRule(row as AutomationRule);
}

export async function updateAutomationRule(
  id: string,
  patch: Partial<
    Pick<
      AutomationRule,
      'name' | 'is_enabled' | 'trigger_type' | 'trigger_config' | 'conditions' | 'actions'
    >
  >,
): Promise<AutomationRule | null> {
  const dbPatch: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (patch.trigger_config !== undefined) {
    dbPatch.trigger_config = toJsonColumn(patch.trigger_config, {});
  }
  if (patch.conditions !== undefined) {
    dbPatch.conditions = toJsonArrayColumn(patch.conditions);
  }
  if (patch.actions !== undefined) {
    dbPatch.actions = toJsonArrayColumn(patch.actions);
  }
  const { error } = await scopedRules().eq('id', id).update(dbPatch);
  if (error) throw new Error(`updateAutomationRule: ${errMsg(error)}`);
  return getAutomationRule(id);
}

export async function deleteAutomationRule(id: string): Promise<void> {
  const { error } = await scopedRules().eq('id', id).delete();
  if (error) throw new Error(`deleteAutomationRule: ${errMsg(error)}`);
}

export async function listRulesByTrigger(
  triggerType: string,
): Promise<AutomationRule[]> {
  const { data, error } = await scopedRules()
    .eq('trigger_type', triggerType)
    .eq('is_enabled', true);
  if (error) throw new Error(`listRulesByTrigger: ${errMsg(error)}`);
  return ((data ?? []) as AutomationRule[]).map(normalizeRule);
}

export async function logAutomationRun(input: {
  ruleId: string;
  status: 'ok' | 'error' | 'skipped';
  triggerPayload?: Record<string, unknown>;
  actionsResult?: unknown[];
  error?: string | null;
}): Promise<void> {
  const projectId = requireProjectId();
  const { error } = await db.from('automation_runs').insert({
    rule_id: input.ruleId,
    project_id: projectId,
    status: input.status,
    trigger_payload: toJsonColumn(input.triggerPayload, {}),
    actions_result: toJsonArrayColumn(input.actionsResult ?? []),
    error: input.error ?? null,
  });
  if (error) throw new Error(`logAutomationRun: ${errMsg(error)}`);

  const rule = await getAutomationRule(input.ruleId);
  if (rule) {
    await scopedRules()
      .eq('id', input.ruleId)
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (rule.run_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      });
  }
}

export async function listAutomationRuns(limit = 30): Promise<AutomationRun[]> {
  const projectId = requireProjectId();
  const { data, error } = await db
    .from('automation_runs')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listAutomationRuns: ${errMsg(error)}`);
  return (data ?? []) as AutomationRun[];
}

export async function logLeadStatusEvent(input: {
  leadId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy?: string;
  reason?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const projectId = requireProjectId();
  const { error } = await db.from('lead_status_events').insert({
    lead_id: input.leadId,
    project_id: projectId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    changed_by: input.changedBy ?? 'user',
    reason: input.reason ?? null,
    meta: toJsonColumn(input.meta, {}),
  });
  if (error) throw new Error(`logLeadStatusEvent: ${errMsg(error)}`);
}

export async function listLeadStatusEvents(
  leadId: string,
  limit = 40,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await db
    .from('lead_status_events')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listLeadStatusEvents: ${errMsg(error)}`);
  return (data ?? []) as Record<string, unknown>[];
}
