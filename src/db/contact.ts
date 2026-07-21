import { db } from './matu.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string;
  source_page: string | null;
  status: string;
  created_at: string;
}

export async function createContactSubmission(input: {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message: string;
  sourcePage?: string;
}): Promise<ContactSubmission> {
  const now = new Date().toISOString();
  const { data, error } = await db.from('contact_submissions').insert({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company?.trim() || null,
    phone: input.phone?.trim() || null,
    message: input.message.trim(),
    source_page: input.sourcePage?.trim() || null,
    status: 'new',
    created_at: now,
  });
  if (error) throw new Error(`createContactSubmission: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as ContactSubmission | undefined;
  if (!row) throw new Error('createContactSubmission returned empty');
  return row;
}
