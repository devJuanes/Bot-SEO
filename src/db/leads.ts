import { db } from './matu.js';
import { countRows, fetchAllRows } from './paginate.js';
import type { AgentRunInsert, Lead, LeadInsert, LeadStatus } from './types.js';
import {
  requireProjectId,
  tenantInsertFields,
  tryTenantInsertFields,
} from '../tenancy/context.js';

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

export const LEAD_PIPELINE: Array<{ key: LeadStatus; label: string }> = [
  { key: 'new', label: 'Nuevo' },
  { key: 'contacted', label: 'Contactado' },
  { key: 'qualified', label: 'Calificado' },
  { key: 'won', label: 'Ganado' },
  { key: 'lost', label: 'Perdido' },
  { key: 'discarded', label: 'Descartado' },
];

export const VALID_LEAD_STATUSES = new Set(LEAD_PIPELINE.map((s) => s.key));

export function isValidLeadStatus(status: string): status is LeadStatus {
  return VALID_LEAD_STATUSES.has(status as LeadStatus);
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scopedLeads() {
  return db.from('leads').eq('project_id', requireProjectId());
}

export async function findLeadByExternalId(
  source: string,
  externalId: string,
): Promise<Lead | null> {
  const { data, error } = await scopedLeads()
    .select('*')
    .eq('source', source)
    .eq('external_id', externalId)
    .limit(1);

  if (error) {
    throw new Error(`findLeadByExternalId failed: ${errorMessage(error)}`);
  }

  const rows = (data ?? []) as Lead[];
  return rows[0] ?? null;
}

export async function findDuplicateLead(input: {
  source: string;
  externalId?: string | null;
  name: string;
  city?: string | null;
  phone?: string | null;
}): Promise<Lead | null> {
  if (input.externalId) {
    const byExternal = await findLeadByExternalId(input.source, input.externalId);
    if (byExternal) return byExternal;
  }

  const phone = normalizePhone(input.phone);
  if (phone) {
    const { data, error } = await scopedLeads()
      .select('*')
      .eq('source', input.source)
      .limit(80);

    if (error) {
      throw new Error(`findDuplicateLead phone scan failed: ${errorMessage(error)}`);
    }

    const match = ((data ?? []) as Lead[]).find(
      (row) => normalizePhone(row.phone) === phone,
    );
    if (match) return match;
  }

  const needle = normalizeName(input.name);
  const city = input.city?.toLowerCase().trim();
  if (needle) {
    const { data, error } = await scopedLeads()
      .select('*')
      .eq('source', input.source)
      .limit(120);

    if (error) {
      throw new Error(`findDuplicateLead name scan failed: ${errorMessage(error)}`);
    }

    const match = ((data ?? []) as Lead[]).find((row) => {
      const sameName = normalizeName(row.name) === needle;
      if (!sameName) return false;
      if (!city || !row.city) return true;
      return row.city.toLowerCase().trim() === city;
    });
    if (match) return match;
  }

  return null;
}

async function fireLeadCreatedAutomation(lead: Lead): Promise<void> {
  try {
    const { dispatchAutomationTrigger } = await import('../services/automation-engine.js');
    await dispatchAutomationTrigger('lead.created', { leadId: lead.id, lead });
  } catch {
    /* ignore */
  }
}

export async function upsertLead(lead: LeadInsert): Promise<{
  action: 'inserted' | 'updated' | 'skipped_duplicate';
  lead: Lead;
}> {
  const existing = await findDuplicateLead({
    source: lead.source,
    externalId: lead.external_id,
    name: lead.name,
    city: lead.city,
    phone: lead.phone,
  });

  if (existing) {
    const { data, error } = await db
      .from('leads')
      .eq('id', existing.id)
      .update({
        phone: lead.phone ?? existing.phone,
        address: lead.address ?? existing.address,
        website: lead.website ?? existing.website,
        needs_website: lead.needs_website ?? existing.needs_website,
        google_maps_url: lead.google_maps_url ?? existing.google_maps_url,
        google_rating: lead.google_rating ?? existing.google_rating,
        google_reviews_count:
          lead.google_reviews_count ?? existing.google_reviews_count,
        latitude: lead.latitude ?? existing.latitude,
        longitude: lead.longitude ?? existing.longitude,
        business_type: lead.business_type ?? existing.business_type,
        city: lead.city ?? existing.city,
        country: lead.country ?? existing.country,
        raw_data: {
          ...(existing.raw_data ?? {}),
          ...(lead.raw_data ?? {}),
          last_seen_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`update lead failed: ${errorMessage(error)}`);
    }

    const updated = (Array.isArray(data) ? data[0] : data) as Lead | undefined;
    return {
      action: 'skipped_duplicate',
      lead: updated ?? existing,
    };
  }

  const { data, error } = await db.from('leads').insert({
    ...lead,
    ...tenantInsertFields(),
    needs_website: lead.needs_website ?? false,
    status: lead.status ?? 'new',
    country: lead.country ?? 'CO',
  });

  if (error) {
    throw new Error(`insert lead failed: ${errorMessage(error)}`);
  }

  const inserted = (Array.isArray(data) ? data[0] : data) as Lead | undefined;
  if (!inserted) {
    throw new Error('insert lead returned no row');
  }

  void fireLeadCreatedAutomation(inserted);

  return { action: 'inserted', lead: inserted };
}

export async function logAgentRun(run: AgentRunInsert): Promise<void> {
  const { error } = await db.from('agent_runs').insert({
    ...run,
    ...tryTenantInsertFields(),
    started_at: run.started_at ?? new Date().toISOString(),
    finished_at: run.finished_at ?? new Date().toISOString(),
    details: run.details ?? {},
  });

  if (error) {
    throw new Error(`logAgentRun failed: ${errorMessage(error)}`);
  }
}

export async function listRecentLeads(limit = 30): Promise<Lead[]> {
  const { data, error } = await scopedLeads()
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listRecentLeads failed: ${errorMessage(error)}`);
  }

  return (data ?? []) as Lead[];
}

export async function listAgentRunsByAgent(
  agentId: string,
  limit = 80,
): Promise<Record<string, unknown>[]> {
  const q = db
    .from('agent_runs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  try {
    const projectId = requireProjectId();
    const { data, error } = await q.eq('project_id', projectId);
    if (error) throw new Error(`listAgentRunsByAgent failed: ${errorMessage(error)}`);
    return (data ?? []) as Record<string, unknown>[];
  } catch {
    const { data, error } = await q;
    if (error) throw new Error(`listAgentRunsByAgent failed: ${errorMessage(error)}`);
    return (data ?? []) as Record<string, unknown>[];
  }
}

export async function listRecentRuns(limit = 20): Promise<Record<string, unknown>[]> {
  const q = db.from('agent_runs').select('*');
  try {
    const projectId = requireProjectId();
    const { data, error } = await q
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listRecentRuns failed: ${errorMessage(error)}`);
    return (data ?? []) as Record<string, unknown>[];
  } catch {
    const { data, error } = await q
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listRecentRuns failed: ${errorMessage(error)}`);
    return (data ?? []) as Record<string, unknown>[];
  }
}

export async function countLeads(): Promise<number> {
  try {
    return await countRows(() => scopedLeads() as never);
  } catch {
    return 0;
  }
}

export async function listLeadsPaginated(input: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  source?: string;
}): Promise<{ leads: Lead[]; total: number }> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 25));
  const offset = Math.max(0, input.offset ?? 0);
  const needle = input.search?.trim().toLowerCase();

  if (needle) {
    const rows = await fetchAllRows<Lead>(() => scopedLeads() as never, '*', {
      orderBy: 'created_at',
    });
    let filtered = rows;
    if (input.status) filtered = filtered.filter((row) => row.status === input.status);
    if (input.source) filtered = filtered.filter((row) => row.source === input.source);
    filtered = filtered.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        (row.phone?.includes(needle) ?? false) ||
        (row.city?.toLowerCase().includes(needle) ?? false) ||
        (row.email?.toLowerCase().includes(needle) ?? false) ||
        (row.business_type?.toLowerCase().includes(needle) ?? false),
    );
    filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return {
      total: filtered.length,
      leads: filtered.slice(offset, offset + limit),
    };
  }

  const buildFiltered = () => {
    let q = scopedLeads() as ReturnType<typeof scopedLeads>;
    if (input.status) q = q.eq('status', input.status) as typeof q;
    if (input.source) q = q.eq('source', input.source) as typeof q;
    return q;
  };

  const total = await countRows(() => buildFiltered() as never);

  const { data, error } = await buildFiltered()
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`listLeadsPaginated failed: ${errorMessage(error)}`);
  }

  return {
    total,
    leads: (data ?? []) as Lead[],
  };
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const { data, error } = await scopedLeads().select('*').eq('id', id).limit(1);
  if (error) {
    throw new Error(`getLeadById failed: ${errorMessage(error)}`);
  }
  return ((data ?? [])[0] as Lead | undefined) ?? null;
}

export async function listLeadsKanban(limitPerColumn = 80): Promise<{
  columns: Record<string, Lead[]>;
  counts: Record<string, number>;
}> {
  const rows = await fetchAllRows<Lead>(() => scopedLeads() as never, '*', {
    orderBy: 'updated_at',
  });

  rows.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  const columns: Record<string, Lead[]> = {};
  const counts: Record<string, number> = {};

  for (const stage of LEAD_PIPELINE) {
    columns[stage.key] = [];
    counts[stage.key] = 0;
  }

  for (const lead of rows) {
    const key = isValidLeadStatus(lead.status) ? lead.status : 'new';
    counts[key] = (counts[key] ?? 0) + 1;
    if ((columns[key]?.length ?? 0) < limitPerColumn) {
      columns[key]!.push(lead);
    }
  }

  return { columns, counts };
}

export async function updateLeadStatus(
  id: string,
  status: string,
  options?: {
    changedBy?: string;
    reason?: string;
    skipAutomation?: boolean;
  },
): Promise<Lead | null> {
  if (!isValidLeadStatus(status)) {
    throw new Error(`Estado inválido: ${status}`);
  }

  const existing = await getLeadById(id);
  if (!existing) return null;

  const fromStatus = existing.status;
  if (fromStatus === status) return existing;

  const { error } = await scopedLeads()
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`updateLeadStatus failed: ${errorMessage(error)}`);
  }

  try {
    const { logLeadStatusEvent } = await import('./automation.js');
    await logLeadStatusEvent({
      leadId: id,
      fromStatus,
      toStatus: status,
      changedBy: options?.changedBy ?? 'user',
      reason: options?.reason,
    });
  } catch {
    /* table may not exist yet */
  }

  const updated = await getLeadById(id);

  if (!options?.skipAutomation && updated) {
    try {
      const { dispatchAutomationTrigger } = await import('../services/automation-engine.js');
      await dispatchAutomationTrigger('lead.status_changed', {
        leadId: id,
        lead: updated,
        fromStatus,
        toStatus: status,
      });
    } catch {
      /* ignore */
    }
  }

  return updated;
}

export async function getLeadStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  needsWebsite: number;
}> {
  const rows = await fetchAllRows<{
    status: string;
    source: string;
    needs_website: boolean;
  }>(() => scopedLeads() as never, 'status, source, needs_website', {
    orderBy: 'id',
  });

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let needsWebsite = 0;
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    if (row.needs_website) needsWebsite += 1;
  }
  return { total: rows.length, byStatus, bySource, needsWebsite };
}
