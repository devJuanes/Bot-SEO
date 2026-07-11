import type { FastifyBaseLogger } from 'fastify';
import { env } from '../config/env.js';
import { listAgents, runAgent } from '../agents/registry.js';
import type { AgentId } from '../agents/types.js';
import { nextHuntTarget } from './hunt-rotation.js';
import { insertContentBrief } from '../db/growth.js';
import {
  getAgentState,
  markAgentFinish,
  markAgentStart,
  pushLog,
  registerRuntimeAgent,
  sendAgentMessage,
} from './state.js';

const running = new Set<AgentId>();

const AGENT_TIMEOUT_MS: Record<AgentId, number> = {
  'lead-hunter': 12 * 60_000,
  'opportunity-scout': 6 * 60_000,
  infiltrator: 2 * 60_000,
  'content-radar': 3 * 60_000,
  'blog-writer': 4 * 60_000,
  'social-creator': 4 * 60_000,
  'community-agent': 3 * 60_000,
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout ${ms}ms · ${label}`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function bootstrapRuntime(): void {
  for (const agent of listAgents()) {
    registerRuntimeAgent(agent.id, agent.name);
  }
  pushLog({
    level: 'info',
    message: 'Runtime online · MatuByte Growth Factory cockpit',
  });
}

export async function executeAgent(
  id: AgentId,
  log: FastifyBaseLogger,
  triggeredBy: 'cron' | 'manual' | 'auto',
  params?: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof runAgent>>> {
  if (running.has(id)) {
    pushLog({
      level: 'warn',
      agentId: id,
      message: 'Skip · agent already running',
    });
    throw new Error(`Agent ${id} is already running`);
  }

  running.add(id);

  const huntParams =
    id === 'lead-hunter' && (!params || Object.keys(params).length === 0)
      ? (() => {
          const target = nextHuntTarget();
          return {
            city: target.city,
            sector: target.sector,
            query: target.query,
            country: target.country,
            countryCode: target.countryCode,
            maxResults: Math.min(env.LEAD_HUNTER_MAX_RESULTS, 8),
          };
        })()
      : params;

  const taskLabel =
    id === 'lead-hunter'
      ? `Hunt · ${String(huntParams?.sector ?? '')} @ ${String(huntParams?.city ?? '')}`
      : `Run · ${id}`;

  markAgentStart(id, taskLabel);

  try {
    const outcome = await withTimeout(
      runAgent(id, {
        env,
        log,
        triggeredBy: triggeredBy === 'auto' ? 'cron' : triggeredBy,
        params: huntParams,
      }),
      AGENT_TIMEOUT_MS[id] ?? 5 * 60_000,
      id,
    );

    const ok = outcome.result.status !== 'error';
    markAgentFinish(
      id,
      ok,
      outcome.result.reason ?? outcome.result.status,
      ok ? undefined : outcome.result.reason,
    );

    if (id === 'lead-hunter' && ok) {
      const details = outcome.result.details ?? {};
      const sector = String(huntParams?.sector ?? 'negocios');
      const city = String(huntParams?.city ?? 'Cali');
      const inserted = Number(details.inserted ?? 0);
      const needsWebsite = Number(details.needsWebsite ?? 0);

      if (needsWebsite > 0 || inserted > 0) {
        await insertContentBrief({
          source_agent: 'lead-hunter',
          title: `${sector} en ${city} sin web: cómo digitalizar el negocio`,
          problem: `Se detectaron ${needsWebsite || inserted} negocios de ${sector} sin sitio web en ${city}`,
          trend: 'PYMES locales aún operan solo por WhatsApp/Maps sin web propia',
          angle: `MatuByte puede ofrecer web + CRM + automatización a ${sector} en ${city}`,
          city,
          sector,
          country: String(huntParams?.countryCode ?? 'CO'),
          priority: 70,
          metadata: details,
        }).catch((err) => {
          log.warn({ err }, 'Failed to enqueue blog brief from hunter');
        });
      }

      sendAgentMessage({
        from: 'lead-hunter',
        to: 'broadcast',
        topic: 'leads.batch',
        body: `Nuevos hallazgos: ${String(details.inserted ?? 0)} insertados · ${String(details.needsWebsite ?? 0)} sin web`,
        payload: details,
      });
      sendAgentMessage({
        from: 'lead-hunter',
        to: 'content-radar',
        topic: 'niche.hot',
        body: `Nicho activo: ${sector} en ${city}`,
        payload: {
          sector,
          city,
          country: huntParams?.country,
        },
      });
      sendAgentMessage({
        from: 'lead-hunter',
        to: 'blog-writer',
        topic: 'seo.opportunity',
        body: `Brief encolado: ${sector} sin web en ${city}`,
        payload: {
          city,
          sector,
        },
      });
    }

    if (id === 'opportunity-scout' && ok) {
      const details = outcome.result.details ?? {};
      sendAgentMessage({
        from: 'opportunity-scout',
        to: 'broadcast',
        topic: 'opportunities.batch',
        body: `Scout: ${String(details.inserted ?? 0)} oportunidades nuevas (empleos/gov/foros)`,
        payload: details,
      });
      sendAgentMessage({
        from: 'opportunity-scout',
        to: 'infiltrator',
        topic: 'threads.candidates',
        body: 'Hay señales en foros/Reddit/empleos listas para seguimiento',
        payload: details,
      });
    }

    if (id === 'social-creator' && ok) {
      sendAgentMessage({
        from: 'social-creator',
        to: 'content-radar',
        topic: 'social.drafted',
        body: outcome.result.reason ?? 'Contenido social generado',
        payload: outcome.result.details,
      });
    }

    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    markAgentFinish(id, false, message, message);
    throw err;
  } finally {
    running.delete(id);
  }
}

/** Autopilot cycles ALL agents so none stay forever idle in the cockpit. */
export function startAutopilot(log: FastifyBaseLogger): void {
  if (!env.AUTO_START_AGENTS) {
    pushLog({
      level: 'info',
      message: 'Autopilot OFF · agents wait for cron/manual',
    });
    return;
  }

  const queue: AgentId[] = [
    'lead-hunter',
    'opportunity-scout',
    'content-radar',
    'blog-writer',
    'social-creator',
    'community-agent',
    'infiltrator',
  ];

  let cursor = 0;
  let busy = false;

  pushLog({
    level: 'info',
    message: `Autopilot ON · cola de ${queue.length} agentes · delay ${env.AUTO_START_DELAY_MS}ms`,
  });

  const tick = async () => {
    if (busy) return;
    busy = true;
    const id = queue[cursor % queue.length]!;
    cursor += 1;

    const state = getAgentState(id);
    if (state?.status === 'running') {
      busy = false;
      return;
    }

    pushLog({
      level: 'info',
      message: `Autopilot queue → ${id}`,
    });

    try {
      await executeAgent(id, log, 'auto');
    } catch (err) {
      log.error({ err, agentId: id }, 'Autopilot queue agent failed');
    } finally {
      busy = false;
    }
  };

  // First tick after delay, then every AUTO_HUNT_INTERVAL_MS / queue length
  // so each agent runs roughly once per AUTO_HUNT_INTERVAL_MS window.
  const gap = Math.max(
    60_000,
    Math.floor(env.AUTO_HUNT_INTERVAL_MS / queue.length),
  );

  setTimeout(() => {
    void tick();
    setInterval(() => {
      void tick();
    }, gap);
  }, env.AUTO_START_DELAY_MS);

  pushLog({
    level: 'info',
    message: `Autopilot gap entre agentes: ${Math.round(gap / 1000)}s`,
  });
}
