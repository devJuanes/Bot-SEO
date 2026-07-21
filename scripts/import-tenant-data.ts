/**
 * Import exported JSON into a new org/project (MatuByte seed).
 *
 * Usage:
 *   npx tsx scripts/import-tenant-data.ts <exportDir> \
 *     --email admin@matubyte.com --password 'Secret123!' --name 'Admin MatuByte'
 *
 * Also migrates .env WA/FB tokens into project_secrets and brand MD into settings.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../src/db/matu.js';
import { ensureSchema } from '../src/db/schema.js';
import {
  createOrganization,
  createProject,
  createUser,
  findUserByEmail,
  setProjectSecret,
  setProjectSetting,
} from '../src/tenancy/store.js';
import { runWithTenantAsync } from '../src/tenancy/context.js';
import { seedDefaultAppConnection } from '../src/db/growth.js';
import { env } from '../src/config/env.js';
import { getMatuByteKnowledge } from '../src/knowledge/matubyte.js';

function arg(name: string, fallback?: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${name}`);
}

function loadJson(dir: string, table: string): Record<string, unknown>[] {
  const path = join(dir, `${table}.json`);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>[];
}

const IMPORT_ORDER = [
  'leads',
  'opportunities',
  'content_briefs',
  'blog_posts',
  'content_scripts',
  'growth_interactions',
  'agent_credentials',
  'app_connections',
  'site_knowledge',
  'bot_settings',
  'forum_threads',
  'forum_posts',
  'whatsapp_conversations',
  'whatsapp_messages',
  'whatsapp_campaigns',
  'whatsapp_campaign_targets',
  'agent_runs',
  'agent_chat_messages',
] as const;

async function insertRows(
  table: string,
  rows: Record<string, unknown>[],
  organizationId: string,
  projectId: string,
): Promise<number> {
  let ok = 0;
  for (const row of rows) {
    const payload = {
      ...row,
      organization_id: organizationId,
      project_id: projectId,
    };
    const { error } = await db.from(table).insert(payload);
    if (error) {
      console.warn(`  ${table} insert skip:`, error);
      continue;
    }
    ok += 1;
  }
  return ok;
}

async function main(): Promise<void> {
  const exportDir = process.argv[2];
  if (!exportDir) {
    throw new Error('Usage: npx tsx scripts/import-tenant-data.ts <exportDir> --email ... --password ...');
  }

  const email = arg('email', 'admin@matubyte.com');
  const password = arg('password', 'ChangeMe123!');
  const name = arg('name', 'Admin MatuByte');
  const orgName = arg('org', 'MatuByte');
  const projectName = arg('project', 'MatuByte Empresa');

  console.log('Ensuring schema…');
  await ensureSchema();

  let userId: string;
  const existing = await findUserByEmail(email);
  if (!existing) {
    const created = await createUser({ email, password, name });
    userId = created.id;
    console.log('Created user', created.email);
  } else {
    userId = existing.id;
    console.log('Using existing user', existing.email);
  }

  let organization;
  try {
    organization = await createOrganization({
      name: orgName,
      slug: 'matubyte',
      ownerUserId: userId,
    });
    console.log('Organization', organization.id, organization.slug);
  } catch (err) {
    console.warn('createOrganization failed (maybe exists):', err);
    const { listOrganizationsForUser } = await import('../src/tenancy/store.js');
    const orgs = await listOrganizationsForUser(userId);
    organization = orgs.find((o) => o.slug === 'matubyte') ?? orgs[0];
    if (!organization) throw err;
    console.log('Using existing organization', organization.id);
  }

  let project;
  try {
    project = await createProject({
      organizationId: organization.id,
      name: projectName,
      slug: 'empresa',
      type: 'company',
      brandName: 'MatuByte',
      autopilotEnabled: env.AUTO_START_AGENTS,
    });
    console.log('Project', project.id, project.slug);
  } catch (err) {
    const { listProjects } = await import('../src/tenancy/store.js');
    const projects = await listProjects(organization.id);
    project = projects.find((p) => p.slug === 'empresa') ?? projects[0];
    if (!project) throw err;
    console.log('Using existing project', project.id);
  }

  await setProjectSetting(project.id, 'brand_name', 'MatuByte');
  await setProjectSetting(project.id, 'brand_knowledge', {
    markdown: getMatuByteKnowledge(),
  });
  if (env.WHATSAPP_CTA_URL) {
    await setProjectSetting(project.id, 'whatsapp_cta_url', env.WHATSAPP_CTA_URL);
  }
  await setProjectSetting(
    project.id,
    'whatsapp_handoff_keywords',
    env.WHATSAPP_HANDOFF_KEYWORDS,
  );
  await setProjectSetting(project.id, 'whatsapp_enabled', env.WHATSAPP_ENABLED);
  await setProjectSetting(project.id, 'facebook_enabled', env.FB_PUBLISHER_ENABLED);
  await setProjectSetting(project.id, 'facebook_dry_run', env.FB_DRY_RUN);
  await setProjectSetting(project.id, 'facebook_auto_publish', env.FB_AUTO_PUBLISH);

  if (env.WHATSAPP_ACCESS_TOKEN) {
    await setProjectSecret(project.id, 'whatsapp_access_token', env.WHATSAPP_ACCESS_TOKEN);
  }
  if (env.WHATSAPP_PHONE_NUMBER_ID) {
    await setProjectSecret(
      project.id,
      'whatsapp_phone_number_id',
      env.WHATSAPP_PHONE_NUMBER_ID,
    );
  }
  if (env.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    await setProjectSecret(
      project.id,
      'whatsapp_business_account_id',
      env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    );
  }
  if (env.WHATSAPP_OWNER_PHONE) {
    await setProjectSecret(project.id, 'whatsapp_owner_phone', env.WHATSAPP_OWNER_PHONE);
  }
  if (env.FB_PAGE_ACCESS_TOKEN) {
    await setProjectSecret(
      project.id,
      'facebook_page_access_token',
      env.FB_PAGE_ACCESS_TOKEN,
    );
  }
  if (env.FB_PAGE_ID) {
    await setProjectSecret(project.id, 'facebook_page_id', env.FB_PAGE_ID);
  }

  console.log('Importing tables…');
  for (const table of IMPORT_ORDER) {
    const rows = loadJson(exportDir, table);
    if (rows.length === 0) continue;
    const n = await insertRows(table, rows, organization.id, project.id);
    console.log(`  ${table}: ${n}/${rows.length}`);
  }

  await runWithTenantAsync(
    { organizationId: organization.id, projectId: project.id, userId },
    () => seedDefaultAppConnection(),
  );

  console.log('\nImport OK');
  console.log(`  org=${organization.id}`);
  console.log(`  project=${project.id}`);
  console.log(`  login=${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
