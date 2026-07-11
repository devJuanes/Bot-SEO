import { db } from './matu.js';
import type { AgentRunInsert, Lead, LeadInsert } from './types.js';

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

export async function findLeadByExternalId(
  source: string,
  externalId: string,
): Promise<Lead | null> {
  const { data, error } = await db
    .from('leads')
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
    const { data, error } = await db
      .from('leads')
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
    const { data, error } = await db
      .from('leads')
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
    // Enrich existing row but never create a duplicate company.
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
    started_at: run.started_at ?? new Date().toISOString(),
    finished_at: run.finished_at ?? new Date().toISOString(),
    details: run.details ?? {},
  });

  if (error) {
    throw new Error(`logAgentRun failed: ${errorMessage(error)}`);
  }
}

export async function listRecentLeads(limit = 30): Promise<Lead[]> {
  const { data, error } = await db
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listRecentLeads failed: ${errorMessage(error)}`);
  }

  return (data ?? []) as Lead[];
}

export async function listRecentRuns(limit = 20): Promise<Record<string, unknown>[]> {
  const { data, error } = await db
    .from('agent_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listRecentRuns failed: ${errorMessage(error)}`);
  }

  return (data ?? []) as Record<string, unknown>[];
}

export async function countLeads(): Promise<number> {
  const { data, error } = await db.from('leads').select('id').limit(500);
  if (error) return 0;
  return Array.isArray(data) ? data.length : 0;
}
