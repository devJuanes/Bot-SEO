import { createClient } from '@devjuanes/matuclient';
import { env } from '../config/env.js';

export const db = createClient({
  url: env.MATUDB_URL,
  projectId: env.MATUDB_PROJECT_ID,
  apiKey: env.MATUDB_SERVICE_KEY || env.MATUDB_API_KEY,
});

/**
 * Lightweight connectivity check against MatuDB.
 */
export async function pingDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await db.from('leads').select('id').limit(1);

    if (error) {
      const message =
        typeof error === 'string'
          ? error
          : (error as { message?: string }).message ?? JSON.stringify(error);

      return { ok: false, error: message };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
