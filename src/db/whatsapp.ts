import { db } from './matu.js';
import { countRows, fetchAllRows } from './paginate.js';
import { normalizePhone } from './leads.js';
import {
  getTenant,
  requireOrganizationId,
  requireProjectId,
  tenantInsertFields,
} from '../tenancy/context.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

function scopedConv() {
  return db.from('whatsapp_conversations').eq('project_id', requireProjectId());
}

export type ConversationMode = 'bot' | 'human';

export interface WhatsAppConversation {
  id: string;
  wa_id: string;
  profile_name: string | null;
  lead_id: string | null;
  mode: ConversationMode;
  assigned_to: string | null;
  status: string;
  last_message_at: string | null;
  last_customer_message_at: string | null;
  unread_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  organization_id?: string | null;
  project_id?: string | null;
  business_type?: string | null;
  lead_name?: string | null;
  lead_city?: string | null;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  wa_message_id: string | null;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'bot' | 'human' | 'system';
  content: string;
  message_type: string;
  template_name: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function findLeadIdByPhone(waId: string): Promise<string | null> {
  const target = normalizePhone(waId);
  if (!target) return null;

  const projectId = getTenant()?.projectId;
  let q = db.from('leads').select('id, phone');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q.limit(400);
  if (error || !data) return null;

  const match = (data as Array<{ id: string; phone: string | null }>).find(
    (row) => normalizePhone(row.phone) === target,
  );
  return match?.id ?? null;
}

export async function getOrCreateConversation(input: {
  waId: string;
  profileName?: string | null;
}): Promise<WhatsAppConversation> {
  const waId = input.waId.replace(/\D/g, '');

  const { data: existing, error: findError } = await scopedConv()
    .select('*')
    .eq('wa_id', waId)
    .limit(1);

  if (findError) throw new Error(`getOrCreateConversation find: ${errMsg(findError)}`);

  if (existing && existing.length > 0) {
    return patchConversationProfile(existing[0] as WhatsAppConversation, input.profileName);
  }

  // wa_id es UNIQUE global — puede existir sin project_id (webhook legacy).
  const { data: globalRows, error: globalError } = await db
    .from('whatsapp_conversations')
    .select('*')
    .eq('wa_id', waId)
    .limit(1);

  if (globalError) {
    throw new Error(`getOrCreateConversation global find: ${errMsg(globalError)}`);
  }

  if (globalRows && globalRows.length > 0) {
    return claimConversationForTenant(globalRows[0] as WhatsAppConversation, input.profileName);
  }

  const leadId = await findLeadIdByPhone(waId);

  const { data, error } = await db.from('whatsapp_conversations').insert({
    wa_id: waId,
    profile_name: input.profileName ?? null,
    lead_id: leadId,
    mode: 'bot',
    status: 'open',
    ...tenantInsertFields(),
  });

  if (error) {
    const message = errMsg(error);
    if (/duplicate|already exists/i.test(message)) {
      const { data: retry } = await db
        .from('whatsapp_conversations')
        .select('*')
        .eq('wa_id', waId)
        .limit(1);
      if (retry?.[0]) {
        return claimConversationForTenant(retry[0] as WhatsAppConversation, input.profileName);
      }
    }
    throw new Error(`getOrCreateConversation insert: ${message}`);
  }

  const created = (Array.isArray(data) ? data[0] : data) as WhatsAppConversation | undefined;
  if (!created) throw new Error('getOrCreateConversation returned empty');
  return created;
}

async function patchConversationProfile(
  conv: WhatsAppConversation,
  profileName?: string | null,
): Promise<WhatsAppConversation> {
  if (profileName && profileName !== conv.profile_name) {
    await db
      .from('whatsapp_conversations')
      .eq('id', conv.id)
      .update({ profile_name: profileName });
    conv.profile_name = profileName;
  }
  return conv;
}

async function claimConversationForTenant(
  conv: WhatsAppConversation,
  profileName?: string | null,
): Promise<WhatsAppConversation> {
  const projectId = requireProjectId();
  const organizationId = requireOrganizationId();
  const patch: Record<string, unknown> = {};

  if (!conv.project_id || conv.project_id !== projectId) {
    patch.project_id = projectId;
    patch.organization_id = organizationId;
  }
  if (profileName && profileName !== conv.profile_name) {
    patch.profile_name = profileName;
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    await db.from('whatsapp_conversations').eq('id', conv.id).update(patch);
    Object.assign(conv, patch);
  }

  return conv;
}

export async function linkConversationToLead(
  conversationId: string,
  leadId: string,
): Promise<void> {
  await db
    .from('whatsapp_conversations')
    .eq('id', conversationId)
    .update({ lead_id: leadId, updated_at: new Date().toISOString() });
}

export async function findConversationByLeadId(
  leadId: string,
): Promise<WhatsAppConversation | null> {
  const { data, error } = await scopedConv()
    .select('*')
    .eq('lead_id', leadId)
    .limit(1);

  if (error) throw new Error(`findConversationByLeadId: ${errMsg(error)}`);
  return ((data ?? [])[0] as WhatsAppConversation | undefined) ?? null;
}

export async function saveMessage(input: {
  conversationId: string;
  waMessageId?: string | null;
  direction: 'inbound' | 'outbound';
  senderType: 'customer' | 'bot' | 'human' | 'system';
  content: string;
  messageType?: string;
  templateName?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  if (input.waMessageId) {
    const { data: existing } = await db
      .from('whatsapp_messages')
      .select('id')
      .eq('wa_message_id', input.waMessageId)
      .limit(1);
    if (existing?.[0]) return;
  }

  const metadata =
    input.metadata == null
      ? '{}'
      : typeof input.metadata === 'string'
        ? input.metadata
        : JSON.stringify(input.metadata);

  const { error } = await db.from('whatsapp_messages').insert({
    conversation_id: input.conversationId,
    wa_message_id: input.waMessageId ?? null,
    direction: input.direction,
    sender_type: input.senderType,
    content: input.content,
    message_type: input.messageType ?? 'text',
    template_name: input.templateName ?? null,
    status: input.status ?? 'sent',
    metadata,
    ...tenantInsertFields(),
  });
  if (error) throw new Error(`saveMessage: ${errMsg(error)}`);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_message_at: now, updated_at: now };
  if (input.direction === 'inbound') {
    patch.last_customer_message_at = now;
  }

  await db.from('whatsapp_conversations').eq('id', input.conversationId).update(patch);

  if (input.direction === 'inbound') {
    await bumpUnread(input.conversationId);
  }
}

async function bumpUnread(conversationId: string): Promise<void> {
  const { data } = await db
    .from('whatsapp_conversations')
    .select('unread_count')
    .eq('id', conversationId)
    .limit(1);
  const current = (data?.[0] as { unread_count?: number } | undefined)?.unread_count ?? 0;
  await db
    .from('whatsapp_conversations')
    .eq('id', conversationId)
    .update({ unread_count: current + 1 });
}

export async function resetUnread(conversationId: string): Promise<void> {
  await db
    .from('whatsapp_conversations')
    .eq('id', conversationId)
    .update({ unread_count: 0 });
}

export async function setConversationMode(
  conversationId: string,
  mode: ConversationMode,
  assignedTo?: string | null,
): Promise<void> {
  const { error } = await db
    .from('whatsapp_conversations')
    .eq('id', conversationId)
    .update({
      mode,
      assigned_to: assignedTo ?? null,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(`setConversationMode: ${errMsg(error)}`);
}

export async function countConversations(): Promise<number> {
  return countRows(() => scopedConv() as never);
}

export async function adoptOrphanConversations(): Promise<void> {
  const projectId = requireProjectId();
  const organizationId = requireOrganizationId();
  const orphans = await fetchAllRows<{ id: string }>(
    () => db.from('whatsapp_conversations').is('project_id', null) as never,
    'id',
    { orderBy: 'updated_at', pageSize: 100 },
  );
  for (const row of orphans) {
    await db
      .from('whatsapp_conversations')
      .eq('id', row.id)
      .update({ project_id: projectId, organization_id: organizationId })
      .catch(() => undefined);
  }
}

export async function getTotalUnreadCount(): Promise<number> {
  await adoptOrphanConversations();
  const rows = await fetchAllRows<{ unread_count?: number }>(
    () => scopedConv() as never,
    'unread_count',
    { orderBy: 'updated_at', pageSize: 100 },
  );
  return rows.reduce((sum, row) => sum + (Number(row.unread_count) || 0), 0);
}

export async function listConversations(limit = 200): Promise<WhatsAppConversation[]> {
  await adoptOrphanConversations();

  const rows = await fetchAllRows<WhatsAppConversation>(
    () => scopedConv() as never,
    'id, wa_id, profile_name, lead_id, mode, assigned_to, status, last_message_at, last_customer_message_at, unread_count, created_at, updated_at',
    { orderBy: 'updated_at', pageSize: 100 },
  );

  rows.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return enrichConversationsWithLead(rows.slice(0, Math.max(1, limit)));
}

async function enrichConversationsWithLead(
  rows: WhatsAppConversation[],
): Promise<WhatsAppConversation[]> {
  if (rows.length === 0) return rows;

  const projectId = getTenant()?.projectId;
  let q = db.from('leads').select('id, name, business_type, city, phone');
  if (projectId) q = q.eq('project_id', projectId);
  const { data } = await q.limit(400);

  const leads = (data ?? []) as Array<{
    id: string;
    name: string | null;
    business_type: string | null;
    city: string | null;
    phone: string | null;
  }>;

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const leadByPhone = new Map<string, (typeof leads)[0]>();
  for (const lead of leads) {
    const key = normalizePhone(lead.phone);
    if (key) leadByPhone.set(key, lead);
  }

  return rows.map((conv) => {
    let lead = conv.lead_id ? leadById.get(conv.lead_id) : undefined;
    if (!lead) {
      const byPhone = leadByPhone.get(normalizePhone(conv.wa_id) || '');
      if (byPhone) {
        lead = byPhone;
        if (!conv.lead_id) {
          void db
            .from('whatsapp_conversations')
            .eq('id', conv.id)
            .update({ lead_id: byPhone.id });
        }
      }
    }
    return {
      ...conv,
      lead_id: conv.lead_id ?? lead?.id ?? null,
      business_type: lead?.business_type ?? null,
      lead_name: lead?.name ?? null,
      lead_city: lead?.city ?? null,
    };
  });
}

export async function getConversationById(id: string): Promise<WhatsAppConversation | null> {
  const { data, error } = await db.from('whatsapp_conversations').select('*').eq('id', id).limit(1);
  if (error) throw new Error(`getConversationById: ${errMsg(error)}`);
  let row = ((data ?? [])[0] as WhatsAppConversation | undefined) ?? null;
  if (!row) return null;

  const projectId = getTenant()?.projectId;
  if (projectId) {
    if (!row.project_id) {
      row = await claimConversationForTenant(row);
    } else if (row.project_id !== projectId) {
      return null;
    }
  }

  const [enriched] = await enrichConversationsWithLead([row]);
  return enriched;
}

export async function listMessages(
  conversationId: string,
  limit = 500,
): Promise<WhatsAppMessage[]> {
  const rows: WhatsAppMessage[] = [];
  let from = 0;
  const pageSize = 100;

  while (from < 10_000) {
    const { data, error } = await db
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`listMessages: ${errMsg(error)}`);
    const batch = (data ?? []) as WhatsAppMessage[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  if (rows.length <= limit) return rows;
  return rows.slice(-limit);
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  template_name: string;
  template_language: string;
  app_slug: string | null;
  status: string;
  total_targets: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

export async function createCampaign(input: {
  name: string;
  templateName: string;
  templateLanguage?: string;
  appSlug?: string;
}): Promise<WhatsAppCampaign> {
  const { data, error } = await db.from('whatsapp_campaigns').insert({
    name: input.name,
    template_name: input.templateName,
    template_language: input.templateLanguage ?? 'es',
    app_slug: input.appSlug ?? null,
    status: 'draft',
    ...tenantInsertFields(),
  });
  if (error) throw new Error(`createCampaign: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as WhatsAppCampaign | undefined;
  if (!row) throw new Error('createCampaign returned empty');
  return row;
}

export async function addCampaignTargets(
  campaignId: string,
  targets: Array<{ leadId?: string | null; waId: string }>,
): Promise<void> {
  if (targets.length === 0) return;
  const tenant = tenantInsertFields();
  const { error } = await db.from('whatsapp_campaign_targets').insert(
    targets.map((t) => ({
      campaign_id: campaignId,
      lead_id: t.leadId ?? null,
      wa_id: t.waId,
      status: 'pending',
      ...tenant,
    })),
  );
  if (error) throw new Error(`addCampaignTargets: ${errMsg(error)}`);

  await db
    .from('whatsapp_campaigns')
    .eq('id', campaignId)
    .update({ total_targets: targets.length, status: 'sending' });
}

export async function listCampaignTargets(
  campaignId: string,
  limit = 500,
): Promise<Array<{ id: string; lead_id: string | null; wa_id: string; status: string }>> {
  const { data, error } = await db
    .from('whatsapp_campaign_targets')
    .select('id, lead_id, wa_id, status')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(Math.min(Math.max(limit, 1), 1000));
  if (error) throw new Error(`listCampaignTargets: ${errMsg(error)}`);
  return (data ?? []) as Array<{
    id: string;
    lead_id: string | null;
    wa_id: string;
    status: string;
  }>;
}

export async function countCampaignTargetsByStatus(
  campaignId: string,
): Promise<{ pending: number; sent: number; failed: number }> {
  const { data, error } = await db
    .from('whatsapp_campaign_targets')
    .select('status')
    .eq('campaign_id', campaignId)
    .limit(1000);
  if (error) throw new Error(`countCampaignTargetsByStatus: ${errMsg(error)}`);
  const rows = (data ?? []) as Array<{ status: string }>;
  return {
    pending: rows.filter((r) => r.status === 'pending').length,
    sent: rows.filter((r) => r.status === 'sent').length,
    failed: rows.filter((r) => r.status === 'failed').length,
  };
}

export async function markCampaignTargetResult(
  targetId: string,
  campaignId: string,
  ok: boolean,
  error?: string,
): Promise<void> {
  await db
    .from('whatsapp_campaign_targets')
    .eq('id', targetId)
    .update({
      status: ok ? 'sent' : 'failed',
      error: error ?? null,
      sent_at: ok ? new Date().toISOString() : null,
    });

  const { data } = await db
    .from('whatsapp_campaigns')
    .select('sent_count, failed_count')
    .eq('id', campaignId)
    .limit(1);
  const current = (data?.[0] as { sent_count?: number; failed_count?: number } | undefined) ?? {};

  await db
    .from('whatsapp_campaigns')
    .eq('id', campaignId)
    .update({
      sent_count: (current.sent_count ?? 0) + (ok ? 1 : 0),
      failed_count: (current.failed_count ?? 0) + (ok ? 0 : 1),
      updated_at: new Date().toISOString(),
    });
}

export async function completeCampaign(campaignId: string): Promise<void> {
  await db
    .from('whatsapp_campaigns')
    .eq('id', campaignId)
    .update({ status: 'completed', updated_at: new Date().toISOString() });
}

export async function listCampaigns(limit = 30): Promise<WhatsAppCampaign[]> {
  const { data, error } = await db
    .from('whatsapp_campaigns')
    .select('*')
    .eq('project_id', requireProjectId())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listCampaigns: ${errMsg(error)}`);
  return (data ?? []) as WhatsAppCampaign[];
}

export async function listFailedCampaignTargets(
  campaignId: string,
  limit = 5,
): Promise<Array<{ wa_id: string; error: string | null; status: string }>> {
  const { data, error } = await db
    .from('whatsapp_campaign_targets')
    .select('wa_id, error, status')
    .eq('campaign_id', campaignId)
    .eq('status', 'failed')
    .limit(limit);
  if (error) throw new Error(`listFailedCampaignTargets: ${errMsg(error)}`);
  return (data ?? []) as Array<{ wa_id: string; error: string | null; status: string }>;
}
