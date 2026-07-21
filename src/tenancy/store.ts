import { db } from '../db/matu.js';
import {
  encryptSecret,
  decryptSecret,
  hashPassword,
  hashToken,
  randomToken,
  signJwt,
  slugify,
  verifyPassword,
} from './crypto.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

export type OrgRole = 'owner' | 'admin' | 'member';
export type ProjectType = 'company' | 'app' | 'other';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  type: ProjectType | string;
  brand_name: string | null;
  is_active: boolean;
  autopilot_enabled: boolean;
  content_enabled?: boolean;
  brand_configured?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, name: row.name };
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const { data, error } = await db.from('users').insert({
    email,
    password_hash: hashPassword(input.password),
    name: input.name.trim(),
  });
  if (error) throw new Error(`createUser: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as UserRow | undefined;
  if (!row) throw new Error('createUser returned empty');
  return toPublicUser(row);
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .limit(1);
  if (error) throw new Error(`findUserByEmail: ${errMsg(error)}`);
  return ((data ?? [])[0] as UserRow | undefined) ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { data, error } = await db.from('users').select('*').eq('id', id).limit(1);
  if (error) throw new Error(`findUserById: ${errMsg(error)}`);
  return ((data ?? [])[0] as UserRow | undefined) ?? null;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return toPublicUser(user);
}

export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: string;
}> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db.from('sessions').insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  });
  if (error) throw new Error(`createSession: ${errMsg(error)}`);

  const jwt = signJwt({ sub: userId, sid: hashToken(token) });
  return { token: jwt, expiresAt };
}

export async function revokeSessionByJwt(token: string): Promise<void> {
  const { verifyJwt } = await import('./crypto.js');
  const payload = verifyJwt(token);
  const sid = typeof payload?.sid === 'string' ? payload.sid : null;
  if (!sid) return;
  await db.from('sessions').eq('token_hash', sid).delete();
}

export async function resolveUserFromToken(
  token: string,
): Promise<PublicUser | null> {
  const { verifyJwt } = await import('./crypto.js');
  const payload = verifyJwt(token);
  if (!payload || typeof payload.sub !== 'string') return null;
  const sid = typeof payload.sid === 'string' ? payload.sid : null;
  if (sid) {
    const { data, error } = await db
      .from('sessions')
      .select('id, expires_at')
      .eq('token_hash', sid)
      .limit(1);
    if (error || !data?.length) return null;
    const expires = new Date(
      (data[0] as { expires_at: string }).expires_at,
    ).getTime();
    if (expires < Date.now()) {
      await db.from('sessions').eq('token_hash', sid).delete();
      return null;
    }
  }
  const user = await findUserById(payload.sub);
  return user ? toPublicUser(user) : null;
}

export async function createOrganization(input: {
  name: string;
  slug?: string;
  ownerUserId: string;
}): Promise<OrganizationRow> {
  const slug = slugify(input.slug || input.name);
  const { data, error } = await db.from('organizations').insert({
    name: input.name.trim(),
    slug,
    owner_user_id: input.ownerUserId,
  });
  if (error) throw new Error(`createOrganization: ${errMsg(error)}`);
  const org = (Array.isArray(data) ? data[0] : data) as OrganizationRow | undefined;
  if (!org) throw new Error('createOrganization returned empty');

  const { error: memErr } = await db.from('organization_members').insert({
    organization_id: org.id,
    user_id: input.ownerUserId,
    role: 'owner',
  });
  if (memErr) throw new Error(`createOrganization member: ${errMsg(memErr)}`);
  return org;
}

export async function listOrganizationsForUser(
  userId: string,
): Promise<Array<OrganizationRow & { role: OrgRole }>> {
  const { data: memberships, error } = await db
    .from('organization_members')
    .select('*')
    .eq('user_id', userId);
  if (error) throw new Error(`listOrganizationsForUser: ${errMsg(error)}`);

  const rows = (memberships ?? []) as Array<{
    organization_id: string;
    role: OrgRole;
  }>;
  if (rows.length === 0) return [];

  const results: Array<OrganizationRow & { role: OrgRole }> = [];
  for (const mem of rows) {
    const { data, error: orgErr } = await db
      .from('organizations')
      .select('*')
      .eq('id', mem.organization_id)
      .limit(1);
    if (orgErr) throw new Error(`listOrganizationsForUser org: ${errMsg(orgErr)}`);
    const org = (data ?? [])[0] as OrganizationRow | undefined;
    if (org) results.push({ ...org, role: mem.role });
  }
  return results;
}

export async function getOrganization(id: string): Promise<OrganizationRow | null> {
  const { data, error } = await db
    .from('organizations')
    .select('*')
    .eq('id', id)
    .limit(1);
  if (error) throw new Error(`getOrganization: ${errMsg(error)}`);
  return ((data ?? [])[0] as OrganizationRow | undefined) ?? null;
}

export async function getMembership(
  organizationId: string,
  userId: string,
): Promise<{ role: OrgRole } | null> {
  const { data, error } = await db
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .limit(1);
  if (error) throw new Error(`getMembership: ${errMsg(error)}`);
  const row = (data ?? [])[0] as { role: OrgRole } | undefined;
  return row ?? null;
}

export async function assertOrgAccess(
  organizationId: string,
  userId: string,
  minRole: OrgRole = 'member',
): Promise<OrgRole> {
  const mem = await getMembership(organizationId, userId);
  if (!mem) throw new Error('Forbidden: not a member of this organization');
  const rank: Record<OrgRole, number> = { member: 1, admin: 2, owner: 3 };
  if (rank[mem.role] < rank[minRole]) {
    throw new Error(`Forbidden: requires role ${minRole}`);
  }
  return mem.role;
}

export async function createProject(input: {
  organizationId: string;
  name: string;
  slug?: string;
  type?: ProjectType;
  brandName?: string;
  autopilotEnabled?: boolean;
}): Promise<ProjectRow> {
  const slug = slugify(input.slug || input.name);
  const { data, error } = await db.from('projects').insert({
    organization_id: input.organizationId,
    name: input.name.trim(),
    slug,
    type: input.type ?? 'company',
    brand_name: input.brandName ?? input.name.trim(),
    is_active: true,
    autopilot_enabled: input.autopilotEnabled ?? false,
  });
  if (error) throw new Error(`createProject: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as ProjectRow | undefined;
  if (!row) throw new Error('createProject returned empty');
  return row;
}

export async function listProjects(
  organizationId: string,
): Promise<ProjectRow[]> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listProjects: ${errMsg(error)}`);
  return (data ?? []) as ProjectRow[];
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const { data, error } = await db.from('projects').select('*').eq('id', id).limit(1);
  if (error) throw new Error(`getProject: ${errMsg(error)}`);
  return ((data ?? [])[0] as ProjectRow | undefined) ?? null;
}

export async function updateProject(
  id: string,
  patch: Partial<{
    name: string;
    brand_name: string;
    type: ProjectType;
    is_active: boolean;
    autopilot_enabled: boolean;
    content_enabled: boolean;
    brand_configured: boolean;
  }>,
): Promise<ProjectRow> {
  const { data, error } = await db
    .from('projects')
    .eq('id', id)
    .update({ ...patch, updated_at: new Date().toISOString() });
  if (error) throw new Error(`updateProject: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as ProjectRow | undefined;
  if (row) return row;
  const fresh = await getProject(id);
  if (!fresh) throw new Error('updateProject: project not found');
  return fresh;
}

export async function listActiveAutopilotProjects(): Promise<ProjectRow[]> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('is_active', true)
    .eq('autopilot_enabled', true)
    .limit(200);
  if (error) throw new Error(`listActiveAutopilotProjects: ${errMsg(error)}`);
  return (data ?? []) as ProjectRow[];
}

export async function listAllActiveProjects(): Promise<ProjectRow[]> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('is_active', true)
    .limit(500);
  if (error) throw new Error(`listAllActiveProjects: ${errMsg(error)}`);
  return (data ?? []) as ProjectRow[];
}

function asJsonbValue(value: unknown): unknown {
  if (value === null || value === undefined) return {};
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { error: 'unserializable' };
    }
  }
  // MatuDB jsonb rejects bare scalars via some insert paths — wrap them.
  return { value };
}

export async function setProjectSetting(
  projectId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const jsonValue = asJsonbValue(value);
  const existing = await db
    .from('project_settings')
    .select('id')
    .eq('project_id', projectId)
    .eq('key', key)
    .limit(1);
  if (existing.error) throw new Error(`setProjectSetting find: ${errMsg(existing.error)}`);
  const row = (existing.data ?? [])[0] as { id: string } | undefined;
  if (row) {
    const { error } = await db
      .from('project_settings')
      .eq('id', row.id)
      .update({ value: jsonValue, updated_at: new Date().toISOString() });
    if (error) throw new Error(`setProjectSetting update: ${errMsg(error)}`);
    return;
  }
  const { error } = await db.from('project_settings').insert({
    project_id: projectId,
    key,
    value: jsonValue,
  });
  if (error) throw new Error(`setProjectSetting insert: ${errMsg(error)}`);
}

export async function getProjectSetting<T = unknown>(
  projectId: string,
  key: string,
): Promise<T | null> {
  const { data, error } = await db
    .from('project_settings')
    .select('value')
    .eq('project_id', projectId)
    .eq('key', key)
    .limit(1);
  if (error) throw new Error(`getProjectSetting: ${errMsg(error)}`);
  const row = (data ?? [])[0] as { value?: unknown } | undefined;
  if (row?.value === undefined || row?.value === null) return null;
  const raw = row.value;
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Object.keys(raw as object).length === 1 &&
    'value' in (raw as object)
  ) {
    return (raw as { value: T }).value;
  }
  return raw as T;
}

export async function listProjectSettings(
  projectId: string,
): Promise<Array<{ key: string; value: unknown }>> {
  const { data, error } = await db
    .from('project_settings')
    .select('key, value')
    .eq('project_id', projectId);
  if (error) throw new Error(`listProjectSettings: ${errMsg(error)}`);
  return ((data ?? []) as Array<{ key: string; value: unknown }>).map((row) => {
    const raw = row.value;
    if (
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      Object.keys(raw as object).length === 1 &&
      'value' in (raw as object)
    ) {
      return { key: row.key, value: (raw as { value: unknown }).value };
    }
    return row;
  });
}

export async function setProjectSecret(
  projectId: string,
  key: string,
  plaintext: string,
): Promise<void> {
  const encrypted_value = encryptSecret(plaintext);
  const existing = await db
    .from('project_secrets')
    .select('id')
    .eq('project_id', projectId)
    .eq('key', key)
    .limit(1);
  if (existing.error) throw new Error(`setProjectSecret find: ${errMsg(existing.error)}`);
  const row = (existing.data ?? [])[0] as { id: string } | undefined;
  if (row) {
    const { error } = await db
      .from('project_secrets')
      .eq('id', row.id)
      .update({ encrypted_value, updated_at: new Date().toISOString() });
    if (error) throw new Error(`setProjectSecret update: ${errMsg(error)}`);
    return;
  }
  const { error } = await db.from('project_secrets').insert({
    project_id: projectId,
    key,
    encrypted_value,
  });
  if (error) throw new Error(`setProjectSecret insert: ${errMsg(error)}`);
}

export async function getProjectSecret(
  projectId: string,
  key: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('project_secrets')
    .select('encrypted_value')
    .eq('project_id', projectId)
    .eq('key', key)
    .limit(1);
  if (error) throw new Error(`getProjectSecret: ${errMsg(error)}`);
  const row = (data ?? [])[0] as { encrypted_value?: string } | undefined;
  if (!row?.encrypted_value) return null;
  return decryptSecret(row.encrypted_value);
}

export async function listProjectSecretKeys(projectId: string): Promise<string[]> {
  const { data, error } = await db
    .from('project_secrets')
    .select('key')
    .eq('project_id', projectId);
  if (error) throw new Error(`listProjectSecretKeys: ${errMsg(error)}`);
  return ((data ?? []) as Array<{ key: string }>).map((r) => r.key);
}

export async function findProjectBySecretValue(
  secretKey: string,
  plaintext: string,
): Promise<ProjectRow | null> {
  const { data, error } = await db
    .from('project_secrets')
    .select('project_id, encrypted_value')
    .eq('key', secretKey)
    .limit(200);
  if (error) throw new Error(`findProjectBySecretValue: ${errMsg(error)}`);

  for (const row of (data ?? []) as Array<{
    project_id: string;
    encrypted_value: string;
  }>) {
    try {
      if (decryptSecret(row.encrypted_value) === plaintext) {
        return getProject(row.project_id);
      }
    } catch {
      // skip corrupt rows
    }
  }
  return null;
}

/** Resuelve el proyecto para webhooks entrantes de WhatsApp (Meta no envía tenant). */
export async function resolveWhatsAppWebhookProject(
  phoneNumberId: string | undefined,
): Promise<ProjectRow | null> {
  if (phoneNumberId) {
    const byPhone = await findProjectBySecretValue(
      'whatsapp_phone_number_id',
      phoneNumberId,
    );
    if (byPhone) return byPhone;
  }

  const { env } = await import('../config/env.js');
  if (env.WHATSAPP_PHONE_NUMBER_ID) {
    if (!phoneNumberId || phoneNumberId === env.WHATSAPP_PHONE_NUMBER_ID) {
      const byEnvPhone = await findProjectBySecretValue(
        'whatsapp_phone_number_id',
        env.WHATSAPP_PHONE_NUMBER_ID,
      );
      if (byEnvPhone) return byEnvPhone;

      if (env.WHATSAPP_ACCESS_TOKEN) {
        const byToken = await findProjectBySecretValue(
          'whatsapp_access_token',
          env.WHATSAPP_ACCESS_TOKEN,
        );
        if (byToken) return byToken;
      }

      const { data } = await db
        .from('project_secrets')
        .select('project_id')
        .eq('key', 'whatsapp_phone_number_id')
        .limit(1);
      const projectId = (data?.[0] as { project_id?: string } | undefined)?.project_id;
      if (projectId) return getProject(projectId);

      const { data: projects } = await db
        .from('projects')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1);
      if (projects?.[0]) return projects[0] as ProjectRow;
    }
  }

  if (phoneNumberId) {
    const { data: projects } = await db
      .from('project_secrets')
      .select('project_id')
      .eq('key', 'whatsapp_phone_number_id')
      .limit(5);
    for (const row of (projects ?? []) as Array<{ project_id: string }>) {
      const p = await getProject(row.project_id);
      if (p) return p;
    }
  }

  return null;
}

export async function registerAndBootstrap(input: {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
  projectName?: string;
}): Promise<{
  user: PublicUser;
  organization: OrganizationRow;
  project: ProjectRow;
  token: string;
}> {
  const user = await createUser(input);
  const organization = await createOrganization({
    name: input.organizationName ?? `${input.name}'s Org`,
    ownerUserId: user.id,
  });
  const project = await createProject({
    organizationId: organization.id,
    name: input.projectName ?? 'Empresa',
    type: 'company',
    brandName: input.organizationName ?? input.name,
  });
  const { DEFAULT_HUNT_SOURCES } = await import('../services/brand-setup.js');
  await setProjectSetting(project.id, 'hunt_sources', DEFAULT_HUNT_SOURCES);
  await setProjectSetting(project.id, 'features', { blogs: false, content_enabled: false });
  const session = await createSession(user.id);
  return { user, organization, project, token: session.token };
}
