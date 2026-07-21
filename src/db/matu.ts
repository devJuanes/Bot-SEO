import { createClient } from '@devjuanes/matuclient';
import { env } from '../config/env.js';

export const db = createClient({
  url: env.MATUDB_URL,
  projectId: env.MATUDB_PROJECT_ID,
  apiKey: env.MATUDB_SERVICE_KEY || env.MATUDB_API_KEY,
});

const PING_RETRIES = 5;
const PING_RETRY_MS = 1500;

function isTransientError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('socket hang up') ||
    lower.includes('aborterror')
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Lightweight connectivity check against MatuDB (with retries for flaky networks).
 */
export async function pingDatabase(): Promise<{ ok: boolean; error?: string }> {
  let lastError = 'unknown error';

  for (let attempt = 1; attempt <= PING_RETRIES; attempt++) {
    try {
      const { error } = await db.rpc('SELECT 1');
      if (!error) return { ok: true };

      lastError =
        typeof error === 'string'
          ? error
          : (error as { message?: string }).message ?? JSON.stringify(error);

      if (!isTransientError(lastError) || attempt === PING_RETRIES) {
        return { ok: false, error: lastError };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (!isTransientError(lastError) || attempt === PING_RETRIES) {
        return { ok: false, error: lastError };
      }
    }

    if (attempt < PING_RETRIES) {
      await sleep(PING_RETRY_MS * attempt);
    }
  }

  return { ok: false, error: lastError };
}
