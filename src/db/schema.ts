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

  const statements: string[] = [];
  let current = '';
  let inSingle = false;

  for (let i = 0; i < withoutComments.length; i++) {
    const ch = withoutComments[i]!;
    const next = withoutComments[i + 1];

    if (inSingle) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += next;
        i += 1;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }

    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

async function applySqlFile(relativePath: string): Promise<void> {
  const schemaPath = join(__dirname, '..', '..', relativePath);
  const sql = readFileSync(schemaPath, 'utf-8');
  const statements = splitSqlStatements(sql);

  for (const statement of statements) {
    const { error } = await db.rpc(`${statement};`);
    if (error) {
      const message =
        typeof error === 'string'
          ? error
          : (error as { message?: string }).message ?? JSON.stringify(error);
      throw new Error(
        `Schema statement failed (${relativePath}): ${message}\nSQL: ${statement.slice(0, 120)}...`,
      );
    }
  }
}

export async function ensureSchema(): Promise<void> {
  await applySqlFile('sql/schema.sql');
  await applySqlFile('sql/tenancy.sql');
}
