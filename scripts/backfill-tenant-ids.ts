/**
 * Fast backfill: one SQL UPDATE per table via MatuDB rpc.
 *
 *   npx tsx scripts/backfill-tenant-ids.ts --email admin@matubyte.com
 */
import { db } from '../src/db/matu.js';
import {
  findUserByEmail,
  listOrganizationsForUser,
  listProjects,
  setProjectSecret,
  setProjectSetting,
  updateProject,
} from '../src/tenancy/store.js';
import { env } from '../src/config/env.js';
import { getMatuByteKnowledge } from '../src/knowledge/matubyte.js';
import { runWithTenantAsync } from '../src/tenancy/context.js';
import { seedDefaultAppConnection } from '../src/db/growth.js';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

const TABLES = [
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

async function main(): Promise<void> {
  let orgId = arg('org');
  let projectId = arg('project');

  if (!orgId || !projectId) {
    const email = arg('email') || 'admin@matubyte.com';
    const user = await findUserByEmail(email);
    if (!user) throw new Error(`User ${email} not found`);
    const orgs = await listOrganizationsForUser(user.id);
    const org = orgs.find((o) => o.slug === 'matubyte') ?? orgs[0];
    if (!org) throw new Error('No organization found');
    const projects = await listProjects(org.id);
    const project = projects.find((p) => p.slug === 'empresa') ?? projects[0];
    if (!project) throw new Error('No project found');
    orgId = org.id;
    projectId = project.id;
  }

  console.log(`Backfill → org=${orgId} project=${projectId}`);

  for (const table of TABLES) {
    const sql = `UPDATE ${table}
      SET organization_id = '${orgId}'::uuid,
          project_id = '${projectId}'::uuid
      WHERE organization_id IS NULL OR project_id IS NULL;`;
    const { error } = await db.rpc(sql);
    if (error) {
      console.warn(`  ${table}:`, error);
    } else {
      console.log(`  ${table}: OK`);
    }
  }

  await setProjectSetting(projectId, 'brand_name', 'MatuByte');
  await setProjectSetting(projectId, 'brand_knowledge', {
    markdown: getMatuByteKnowledge(),
  });
  if (env.WHATSAPP_CTA_URL) {
    await setProjectSetting(projectId, 'whatsapp_cta_url', env.WHATSAPP_CTA_URL);
  }
  await setProjectSetting(
    projectId,
    'whatsapp_handoff_keywords',
    env.WHATSAPP_HANDOFF_KEYWORDS,
  );
  await setProjectSetting(projectId, 'whatsapp_enabled', env.WHATSAPP_ENABLED);
  await setProjectSetting(projectId, 'facebook_enabled', env.FB_PUBLISHER_ENABLED);
  await setProjectSetting(projectId, 'facebook_dry_run', env.FB_DRY_RUN);
  await setProjectSetting(projectId, 'facebook_auto_publish', env.FB_AUTO_PUBLISH);

  if (env.WHATSAPP_ACCESS_TOKEN) {
    await setProjectSecret(projectId, 'whatsapp_access_token', env.WHATSAPP_ACCESS_TOKEN);
  }
  if (env.WHATSAPP_PHONE_NUMBER_ID) {
    await setProjectSecret(
      projectId,
      'whatsapp_phone_number_id',
      env.WHATSAPP_PHONE_NUMBER_ID,
    );
  }
  if (env.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    await setProjectSecret(
      projectId,
      'whatsapp_business_account_id',
      env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    );
  }
  if (env.WHATSAPP_OWNER_PHONE) {
    await setProjectSecret(projectId, 'whatsapp_owner_phone', env.WHATSAPP_OWNER_PHONE);
  }
  if (env.FB_PAGE_ACCESS_TOKEN) {
    await setProjectSecret(
      projectId,
      'facebook_page_access_token',
      env.FB_PAGE_ACCESS_TOKEN,
    );
  }
  if (env.FB_PAGE_ID) {
    await setProjectSecret(projectId, 'facebook_page_id', env.FB_PAGE_ID);
  }

  await updateProject(projectId, {
    autopilot_enabled: true,
    is_active: true,
  });

  await runWithTenantAsync(
    { organizationId: orgId, projectId },
    () => seedDefaultAppConnection(),
  );

  console.log('\nBackfill OK');
  console.log('  Login: http://127.0.0.1:4100/login.html');
  console.log('  Email: admin@matubyte.com');
  console.log('  Password: MatuByte2026!');
  console.log(`  Project: ${projectId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
