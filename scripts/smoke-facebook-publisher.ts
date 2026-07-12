/**
 * Smoke test del agente facebook-publisher.
 *
 * Uso:
 *   FB_PUBLISHER_ENABLED=true FB_DRY_RUN=true \
 *     npx tsx scripts/smoke-facebook-publisher.ts [trendHint]
 *
 * Variables relevantes:
 *   - FB_DRY_RUN=true          siempre (default en dev), no publica de verdad
 *   - FB_PUBLISHER_ENABLED=true necesario para que el agente no skipee
 *   - LLM_API_KEY              necesaria para que el LLM responda
 *
 * Salidas:
 *   - Imprime el AgentResult completo (status, reason, details)
 *   - Lista los últimos content_scripts con platform='facebook' para verificar
 *     que se insertó el row con publish_status=published y fb_post_id=fake_*
 */
import { env } from '../src/config/env.js';
import { db } from '../src/db/matu.js';
import { runAgent } from '../src/agents/registry.js';

const logger = {
  info: (...args: unknown[]) => console.log('[info]', ...args),
  warn: (...args: unknown[]) => console.warn('[warn]', ...args),
  error: (...args: unknown[]) => console.error('[error]', ...args),
  debug: (...args: unknown[]) => console.debug('[debug]', ...args),
  child: () => logger,
  level: 'info',
  fatal: (...args: unknown[]) => console.error('[fatal]', ...args),
  trace: (...args: unknown[]) => console.debug('[trace]', ...args),
  silent: () => undefined,
} as unknown as import('fastify').FastifyBaseLogger;

async function fetchLatestFbPosts(limit = 3): Promise<unknown[]> {
  const { data, error } = await db
    .from('content_scripts')
    .select('id, topic, hook, publish_status, fb_post_id, fb_permalink_url, fb_photo_url, trend_source, trend_url, fb_published_at, created_at')
    .eq('platform', 'facebook')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Error querying content_scripts:', error);
    return [];
  }
  return (data ?? []) as unknown[];
}

async function main(): Promise<void> {
  if (!env.LLM_API_KEY) {
    console.error('LLM_API_KEY no configurada — abortando smoke test.');
    process.exit(1);
  }

  const trendHint = process.argv[2];

  console.log('▶ Ejecutando agente facebook-publisher (manual)');
  console.log('  FB_DRY_RUN=', env.FB_DRY_RUN);
  console.log('  FB_PUBLISHER_ENABLED=', env.FB_PUBLISHER_ENABLED);
  console.log('  trendHint=', trendHint ?? '(none)');

  let result;
  try {
    const out = await runAgent('facebook-publisher', {
      env,
      log: logger,
      triggeredBy: 'manual',
      params: {
        forceDryRun: true, // smoke test nunca publica de verdad
        ...(trendHint ? { trendHint } : {}),
      },
    });
    result = out.result;
  } catch (err) {
    console.error('runAgent lanzó excepción:', err);
    process.exit(1);
  }

  console.log('\n──── AgentResult ────');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n──── Últimos content_scripts (facebook) ────');
  const latest = await fetchLatestFbPosts(3);
  console.log(JSON.stringify(latest, null, 2));

  if (result.status === 'error') {
    console.error('\n✗ Agente terminó en error.');
    process.exit(2);
  }
  if (!latest.length) {
    console.error('\n✗ No se insertó ningún row en content_scripts.');
    process.exit(3);
  }
  console.log('\n✓ Smoke test OK.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
