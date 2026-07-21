/**
 * Export current MatuDB business tables to JSON (before/without tenancy backfill).
 * Usage: npx tsx scripts/export-tenant-data.ts [outdir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../src/db/matu.js';

const TABLES = [
  'leads',
  'opportunities',
  'content_briefs',
  'blog_posts',
  'content_scripts',
  'growth_interactions',
  'agent_runs',
  'agent_chat_messages',
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
] as const;

async function dumpTable(table: string): Promise<unknown[]> {
  const { data, error } = await db.from(table).select('*').limit(5000);
  if (error) {
    console.warn(`skip ${table}:`, error);
    return [];
  }
  return (data ?? []) as unknown[];
}

async function main(): Promise<void> {
  const outDir =
    process.argv[2] ||
    join(process.cwd(), 'exports', `tenant-${new Date().toISOString().slice(0, 10)}`);
  mkdirSync(outDir, { recursive: true });

  const manifest: Record<string, number> = {};
  for (const table of TABLES) {
    const rows = await dumpTable(table);
    writeFileSync(join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    manifest[table] = rows.length;
    console.log(`${table}: ${rows.length} rows`);
  }

  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(
      { exportedAt: new Date().toISOString(), tables: manifest },
      null,
      2,
    ),
  );
  console.log(`\nExport OK → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
