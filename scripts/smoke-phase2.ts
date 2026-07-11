import { pingDatabase } from '../src/db/matu.js';
import { runAgent } from '../src/agents/registry.js';
import { env } from '../src/config/env.js';

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

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'ping';

  if (mode === 'ping') {
    const result = await pingDatabase();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
    return;
  }

  if (mode === 'hunt') {
    const { result } = await runAgent('lead-hunter', {
      env,
      log: logger,
      triggeredBy: 'manual',
      params: {
        sector: 'peluquerias',
        city: 'Cali',
        maxResults: 5,
      },
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'error') process.exit(1);
    return;
  }

  console.error('Usage: tsx scripts/smoke-phase2.ts [ping|hunt]');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
