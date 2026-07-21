import { db } from '../src/db/matu.js';
import {
  findUserByEmail,
  listOrganizationsForUser,
  listProjects,
} from '../src/tenancy/store.js';

async function main(): Promise<void> {
  const email = 'admin@matubyte.com';
  const user = await findUserByEmail(email);
  if (!user) {
    console.log('User not found');
    return;
  }
  const orgs = await listOrganizationsForUser(user.id);
  console.log('Orgs:', orgs.map((o) => ({ id: o.id, slug: o.slug })));

  for (const org of orgs) {
    const projects = await listProjects(org.id);
    console.log('Projects:', projects.map((p) => ({
      id: p.id,
      slug: p.slug,
      autopilot: p.autopilot_enabled,
    })));
  }

  const projectId = 'c4ec9891-5a9d-4fc9-bb7b-b126d57e4902';

  for (const table of ['leads', 'blog_posts', 'opportunities']) {
    const { data: all, error: e1 } = await db.from(table).select('id').limit(5);
    const { data: scoped, error: e2 } = await db
      .from(table)
      .select('id, project_id, organization_id')
      .eq('project_id', projectId)
      .limit(5);
    const { data: nullProj } = await db
      .from(table)
      .select('id')
      .is('project_id', null)
      .limit(3);

    console.log(`\n${table}:`);
    console.log('  total sample:', all?.length ?? 0, e1 || '');
    console.log('  with project_id:', scoped?.length ?? 0, e2 || '');
    if (scoped?.[0]) console.log('  sample row:', scoped[0]);
    console.log('  null project_id sample:', nullProj?.length ?? 0);
  }

  // Count via raw SQL
  const { error: countErr } = await db.rpc(
    `SELECT COUNT(*)::int AS c FROM leads WHERE project_id = '${projectId}'::uuid;`,
  );
  console.log('\nSQL count leads:', countErr || 'ok');
}

main().catch(console.error);
