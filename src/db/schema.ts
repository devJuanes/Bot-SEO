import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './matu.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RPC_RETRIES = 3;
const RPC_RETRY_MS = 2000;

function isTransientRpcError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('socket hang up')
  );
}

async function rpcWithRetry(sql: string): Promise<void> {
  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= RPC_RETRIES; attempt++) {
    try {
      const { error } = await db.rpc(sql);
      if (!error) return;
      lastError =
        typeof error === 'string'
          ? error
          : (error as { message?: string }).message ?? JSON.stringify(error);
      if (!isTransientRpcError(lastError) || attempt === RPC_RETRIES) {
        throw new Error(lastError);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (!isTransientRpcError(lastError) || attempt === RPC_RETRIES) {
        throw err instanceof Error ? err : new Error(lastError);
      }
    }
    await new Promise((r) => setTimeout(r, RPC_RETRY_MS * attempt));
  }
  throw new Error(lastError);
}
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
    try {
      await rpcWithRetry(`${statement};`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Schema statement failed (${relativePath}): ${message}\nSQL: ${statement.slice(0, 120)}...`,
      );
    }
  }
}

export async function ensureSchema(): Promise<void> {
  await applySqlFile('sql/schema.sql');
  await applySqlFile('sql/tenancy.sql');
  await applySqlFile('sql/automation.sql');
  await applySqlFile('sql/contact.sql');
  await applySqlFile('sql/billing.sql');
}