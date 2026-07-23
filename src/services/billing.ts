import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { env } from '../config/env.js';
import { db } from '../db/matu.js';
import {
  createPaymentLink,
  getPaymentStatus,
  isPaidStatus,
  isPayMatuConfigured,
} from './paymatubyte.js';
import {
  createSession,
  findUserByEmail,
  registerAndBootstrap,
  type OrganizationRow,
  type ProjectRow,
  type PublicUser,
  updateProject,
  setProjectSetting,
} from '../tenancy/store.js';

export const PLANS = {
  'plan-pro': {
    id: 'plan-pro',
    name: 'Growth Factory Pro',
    amount: 50_000,
    currency: 'COP',
    months: 1,
  },
} as const;

export type PlanId = keyof typeof PLANS;

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

function signupKey(): Buffer {
  const secret = env.SECRETS_MASTER_KEY || env.AUTH_JWT_SECRET;
  return scryptSync(secret, 'growth-signup-v1', 32);
}

export function encryptPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', signupKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptPassword(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', signupKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export interface InvitationCodeRow {
  id: string;
  code: string;
  plan: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
}

export async function findInvitationCode(code: string): Promise<InvitationCodeRow | null> {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await db
    .from('invitation_codes')
    .select('*')
    .eq('code', normalized)
    .limit(1);
  if (error) throw new Error(`findInvitationCode: ${errMsg(error)}`);
  return ((data ?? [])[0] as InvitationCodeRow | undefined) ?? null;
}

export function isInvitationCodeValid(row: InvitationCodeRow): boolean {
  if (!row.is_active) return false;
  if (row.used_count >= row.max_uses) return false;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return false;
  return true;
}

export async function redeemInvitationCode(
  code: string,
  userId: string,
): Promise<InvitationCodeRow> {
  const row = await findInvitationCode(code);
  if (!row || !isInvitationCodeValid(row)) {
    throw new Error('Código de invitación inválido o expirado');
  }

  const { error: useErr } = await db.from('invitation_code_uses').insert({
    invitation_code_id: row.id,
    user_id: userId,
  });
  if (useErr) throw new Error(`redeemInvitationCode: ${errMsg(useErr)}`);

  const { error: updErr } = await db
    .from('invitation_codes')
    .eq('id', row.id)
    .update({ used_count: row.used_count + 1 });
  if (updErr) throw new Error(`redeemInvitationCode update: ${errMsg(updErr)}`);

  return row;
}

export async function activatePlanForOrganization(input: {
  organizationId: string;
  projectId: string;
  planId: string;
  source: 'payment' | 'invitation';
  paymentReference?: string;
  amount?: number;
  linkId?: string;
  transactionId?: string;
  months?: number;
}): Promise<void> {
  const months = input.months ?? PLANS['plan-pro'].months;
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  await updateProject(input.projectId, { content_enabled: true });
  await setProjectSetting(input.projectId, 'features', {
    blogs: true,
    content_enabled: true,
    plan: input.planId,
  });
  await setProjectSetting(input.projectId, 'subscription', {
    plan_id: input.planId,
    status: 'active',
    source: input.source,
    expires_at: expiresAt.toISOString(),
  });

  const { data: existing } = await db
    .from('organization_subscriptions')
    .select('id')
    .eq('organization_id', input.organizationId)
    .limit(1);

  const payload = {
    organization_id: input.organizationId,
    plan_id: input.planId,
    status: 'active',
    payment_reference: input.paymentReference ?? null,
    amount: input.amount ?? null,
    currency: 'COP',
    link_id: input.linkId ?? null,
    transaction_id: input.transactionId ?? null,
    starts_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    paid_at: input.source === 'payment' ? now.toISOString() : null,
    source: input.source,
  };

  if (existing?.[0]) {
    const { error } = await db
      .from('organization_subscriptions')
      .eq('id', (existing[0] as { id: string }).id)
      .update(payload);
    if (error) throw new Error(`activatePlan update: ${errMsg(error)}`);
  } else {
    const { error } = await db.from('organization_subscriptions').insert(payload);
    if (error) throw new Error(`activatePlan insert: ${errMsg(error)}`);
  }
}

export async function registerWithInvitation(input: {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
  projectName?: string;
  invitationCode: string;
}): Promise<{
  user: PublicUser;
  organization: OrganizationRow;
  project: ProjectRow;
  token: string;
  plan: string;
}> {
  const invite = await findInvitationCode(input.invitationCode);
  if (!invite || !isInvitationCodeValid(invite)) {
    throw new Error('Código de invitación inválido o expirado');
  }

  const existing = await findUserByEmail(input.email);
  if (existing) throw new Error('Email already registered');

  const result = await registerAndBootstrap({
    email: input.email,
    password: input.password,
    name: input.name,
    organizationName: input.organizationName,
    projectName: input.projectName,
  });

  await redeemInvitationCode(input.invitationCode, result.user.id);
  await activatePlanForOrganization({
    organizationId: result.organization.id,
    projectId: result.project.id,
    planId: invite.plan === 'vip' ? 'vip' : invite.plan,
    source: 'invitation',
    months: 12,
  });

  return { ...result, plan: invite.plan };
}

function makeReference(): string {
  return `GF-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

export async function startPaidSignup(input: {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}): Promise<{ checkoutUrl: string; reference: string }> {
  if (!isPayMatuConfigured()) {
    throw new Error('Pasarela de pagos no configurada. Contacta a soporte.');
  }

  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('Email already registered');

  const reference = makeReference();
  const returnUrl = `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/acceso/pago-resultado`;

  const link = await createPaymentLink({
    productId: 'plan-pro',
    reference,
    description: PLANS['plan-pro'].name,
    returnUrl,
  });

  const { error } = await db.from('pending_signups').insert({
    email,
    password_enc: encryptPassword(input.password),
    name: input.name.trim(),
    organization_name: input.organizationName?.trim() || null,
    plan_id: 'plan-pro',
    payment_reference: reference,
    link_id: link.link_id,
    status: 'pending',
  });
  if (error) throw new Error(`startPaidSignup: ${errMsg(error)}`);

  return { checkoutUrl: link.url, reference };
}

export async function completePaidSignup(reference: string): Promise<{
  user: PublicUser;
  organization: OrganizationRow;
  project: ProjectRow;
  token: string;
}> {
  const { data, error } = await db
    .from('pending_signups')
    .select('*')
    .eq('payment_reference', reference)
    .limit(1);
  if (error) throw new Error(`completePaidSignup: ${errMsg(error)}`);

  const pending = (data ?? [])[0] as {
    id: string;
    email: string;
    password_enc: string;
    name: string;
    organization_name: string | null;
    plan_id: string;
    status: string;
    user_id: string | null;
    organization_id: string | null;
    link_id: string | null;
  } | undefined;

  if (!pending) throw new Error('Registro no encontrado');
  if (pending.status === 'completed' && pending.user_id) {
    const user = await findUserByEmail(pending.email);
    if (!user) throw new Error('Cuenta completada pero usuario no encontrado');
    const session = await createSession(user.id);
    throw Object.assign(new Error('ALREADY_COMPLETED'), {
      code: 'ALREADY_COMPLETED',
      token: session.token,
      userId: user.id,
    });
  }

  const payment = await getPaymentStatus(reference);
  if (!isPaidStatus(payment.status)) {
    throw new Error('El pago aún no ha sido confirmado');
  }

  const password = decryptPassword(pending.password_enc);
  const result = await registerAndBootstrap({
    email: pending.email,
    password,
    name: pending.name,
    organizationName: pending.organization_name ?? undefined,
  });

  const plan = PLANS[pending.plan_id as PlanId] ?? PLANS['plan-pro'];
  await activatePlanForOrganization({
    organizationId: result.organization.id,
    projectId: result.project.id,
    planId: pending.plan_id,
    source: 'payment',
    paymentReference: reference,
    amount: plan.amount,
    linkId: payment.link_id ?? pending.link_id ?? undefined,
    transactionId: payment.transaction_id ?? undefined,
    months: plan.months,
  });

  const paidAt = new Date().toISOString();
  await db
    .from('pending_signups')
    .eq('id', pending.id)
    .update({
      status: 'completed',
      user_id: result.user.id,
      organization_id: result.organization.id,
      completed_at: paidAt,
    });

  return result;
}

export async function validateInvitationCode(code: string): Promise<{ valid: boolean; plan?: string }> {
  const row = await findInvitationCode(code);
  if (!row || !isInvitationCodeValid(row)) return { valid: false };
  return { valid: true, plan: row.plan };
}
