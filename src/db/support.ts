import { db } from './matu.js';
import {
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

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportTicketCategory =
  | 'general'
  | 'technical'
  | 'whatsapp'
  | 'facebook'
  | 'billing'
  | 'feature';

export interface SupportTicket {
  id: string;
  project_id: string;
  organization_id: string | null;
  user_id: string | null;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  priority: string;
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

function scopedTickets() {
  return db.from('support_tickets').eq('project_id', requireProjectId());
}

export async function createSupportTicket(input: {
  userId: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  priority?: string;
}): Promise<SupportTicket> {
  const now = new Date().toISOString();
  const { data, error } = await db.from('support_tickets').insert({
    category: input.category,
    subject: input.subject.trim(),
    message: input.message.trim(),
    status: 'open',
    priority: input.priority ?? 'normal',
    user_id: input.userId,
    created_at: now,
    updated_at: now,
    ...tenantInsertFields(),
  });
  if (error) throw new Error(`createSupportTicket: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as SupportTicket | undefined;
  if (!row) throw new Error('createSupportTicket returned empty');
  return row;
}

export async function listSupportTickets(input: {
  userId?: string;
  limit?: number;
}): Promise<SupportTicket[]> {
  const limit = Math.min(50, Math.max(1, input.limit ?? 30));
  let q = scopedTickets().select('*').order('created_at', { ascending: false }).limit(limit);
  if (input.userId) q = q.eq('user_id', input.userId);
  const { data, error } = await q;
  if (error) throw new Error(`listSupportTickets: ${errMsg(error)}`);
  return (data ?? []) as SupportTicket[];
}

export async function getSupportTicketById(id: string): Promise<SupportTicket | null> {
  const { data, error } = await scopedTickets().select('*').eq('id', id).limit(1);
  if (error) throw new Error(`getSupportTicketById: ${errMsg(error)}`);
  return ((data ?? [])[0] as SupportTicket | undefined) ?? null;
}

export async function countOpenTickets(userId: string): Promise<number> {
  const { data, error } = await scopedTickets()
    .select('id')
    .eq('user_id', userId)
    .in('status', ['open', 'in_progress']);
  if (error) return 0;
  return Array.isArray(data) ? data.length : 0;
}
