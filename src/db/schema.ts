import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './matu.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  return withoutComments
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function ensureSchema(): Promise<void> {
  const schemaPath = join(__dirname, '..', '..', 'sql', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');
  const statements = splitSqlStatements(sql);

  for (const statement of statements) {
    const { error } = await db.rpc(`${statement};`);
    if (error) {
      const message =
        typeof error === 'string'
          ? error
          : (error as { message?: string }).message ?? JSON.stringify(error);
      throw new Error(`Schema statement failed: ${message}\nSQL: ${statement.slice(0, 120)}...`);
    }
  }
}
