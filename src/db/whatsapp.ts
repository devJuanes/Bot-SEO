import { db } from './matu.js';
import { normalizePhone } from './leads.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
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
  created_at: string;
}

export async function findLeadIdByPhone(waId: string): Promise<string | null> {
  const target = normalizePhone(waId);
  if (!target) return null;

  const { data, error } = await db.from('leads').select('id, phone').limit(400);
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
  const { data: existing, error: findError } = await db
    .from('whatsapp_conversations')
    .select('*')
    .eq('wa_id', input.waId)
    .limit(1);

  if (findError) throw new Error(`getOrCreateConversation find: ${errMsg(findError)}`);

  if (existing && existing.length > 0) {
    const conv = existing[0] as WhatsAppConversation;
    if (input.profileName && input.profileName !== conv.profile_name) {
      await db
        .from('whatsapp_conversations')
        .eq('id', conv.id)
        .update({ profile_name: input.profileName });
      conv.profile_name = input.profileName;
    }
    return conv;
  }

  const leadId = await findLeadIdByPhone(input.waId);

  const { data, error } = await db.from('whatsapp_conversations').insert({
    wa_id: input.waId,
    profile_name: input.profileName ?? null,
    lead_id: leadId,
    mode: 'bot',
    status: 'open',
  });
  if (error) throw new Error(`getOrCreateConversation insert: ${errMsg(error)}`);

  const created = (Array.isArray(data) ? data[0] : data) as WhatsAppConversation | undefined;
  if (!created) throw new Error('getOrCreateConversation returned empty');
  return created;
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
}): Promise<void> {
  const { error } = await db.from('whatsapp_messages').insert({
    conversation_id: input.conversationId,
    wa_message_id: input.waMessageId ?? null,
    direction: input.direction,
    sender_type: input.senderType,
    content: input.content,
    message_type: input.messageType ?? 'text',
    template_name: input.templateName ?? null,
    status: input.status ?? 'sent',
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

export async function listConversations(limit = 50): Promise<WhatsAppConversation[]> {
  const { data, error } = await db
    .from('whatsapp_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listConversations: ${errMsg(error)}`);
  return (data ?? []) as WhatsAppConversation[];
}

export async function getConversationById(id: string): Promise<WhatsAppConversation | null> {
  const { data, error } = await db
    .from('whatsapp_conversations')
    .select('*')
    .eq('id', id)
    .limit(1);
  if (error) throw new Error(`getConversationById: ${errMsg(error)}`);
  return ((data ?? [])[0] as WhatsAppConversation | undefined) ?? null;
}

export async function listMessages(
  conversationId: string,
  limit = 100,
): Promise<WhatsAppMessage[]> {
  const { data, error } = await db
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listMessages: ${errMsg(error)}`);
  return (data ?? []) as WhatsAppMessage[];
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
  const { error } = await db.from('whatsapp_campaign_targets').insert(
    targets.map((t) => ({
      campaign_id: campaignId,
      lead_id: t.leadId ?? null,
      wa_id: t.waId,
      status: 'pending',
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
): Promise<Array<{ id: string; lead_id: string | null; wa_id: string; status: string }>> {
  const { data, error } = await db
    .from('whatsapp_campaign_targets')
    .select('id, lead_id, wa_id, status')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');
  if (error) throw new Error(`listCampaignTargets: ${errMsg(error)}`);
  return (data ?? []) as Array<{
    id: string;
    lead_id: string | null;
    wa_id: string;
    status: string;
  }>;
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
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listCampaigns: ${errMsg(error)}`);
  return (data ?? []) as WhatsAppCampaign[];
}
