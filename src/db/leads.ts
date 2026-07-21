import { db } from './matu.js';
import type { AgentRunInsert, Lead, LeadInsert } from './types.js';
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
    const { data, error } = await scopedLeads().select('id').limit(5000);
    if (error) return 0;
    return Array.isArray(data) ? data.length : 0;
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

  const { data, error } = await scopedLeads()
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`listLeadsPaginated failed: ${errorMessage(error)}`);
  }

  let rows = (data ?? []) as Lead[];
  const needle = input.search?.trim().toLowerCase();
  if (needle) {
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        (row.phone?.includes(needle) ?? false) ||
        (row.city?.toLowerCase().includes(needle) ?? false) ||
        (row.email?.toLowerCase().includes(needle) ?? false) ||
        (row.business_type?.toLowerCase().includes(needle) ?? false),
    );
  }
  if (input.status) {
    rows = rows.filter((row) => row.status === input.status);
  }
  if (input.source) {
    rows = rows.filter((row) => row.source === input.source);
  }

  return {
    total: rows.length,
    leads: rows.slice(offset, offset + limit),
  };
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const { data, error } = await scopedLeads().select('*').eq('id', id).limit(1);
  if (error) {
    throw new Error(`getLeadById failed: ${errorMessage(error)}`);
  }
  return ((data ?? [])[0] as Lead | undefined) ?? null;
}

export async function getLeadStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  needsWebsite: number;
}> {
  const { data, error } = await scopedLeads().select('status, source, needs_website');
  if (error) {
    throw new Error(`getLeadStats failed: ${errorMessage(error)}`);
  }
  const rows = (data ?? []) as Array<{
    status: string;
    source: string;
    needs_website: boolean;
  }>;
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
