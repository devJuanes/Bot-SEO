import {
  buildKnowledgeContext,
  gatherMarketSignals,
  insertContentBrief,
} from '../db/growth.js';
import { logAgentRun } from '../db/leads.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import { getMatuByteSummary } from '../knowledge/matubyte.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';
import type { Agent, AgentContext, AgentResult } from './types.js';

function extractJsonArray(text: string): Record<string, unknown>[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    const obj = text.match(/\{[\s\S]*\}/);
    if (!obj) return [];
    try {
      return [JSON.parse(obj[0]) as Record<string, unknown>];
    } catch {
      return [];
    }
  }
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

export const contentRadarAgent: Agent = {
  id: 'content-radar',
  name: 'Agente Radar & Estratega',
  description:
    'Detecta tendencias y problemas de mercado (leads/opps) y encola briefs para el Redactor.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();
    const brand = getMatuByteSummary();

    if (!isLlmConfigured() || /smoke|replace_me/i.test(ctx.env.LLM_API_KEY)) {
      return {
        status: 'error',
        reason: 'LLM_API_KEY no configurada para el Radar',
      };
    }

    try {
      pushLog({
        level: 'info',
        agentId: this.id,
        message: 'Analizando señales de mercado (leads + opportunities)…',
      });

      const signals = await gatherMarketSignals();
      const knowledge = await buildKnowledgeContext();

      const completion = await chatCompletion({
        temperature: 0.8,
        maxTokens: 1800,
        messages: [
          {
            role: 'system',
            content: `Eres estratega de contenidos de ${brand.company} (${brand.hq}).
Detectas problemas reales de negocios, emprendedores, developers y tendencias para blogs SEO.
Devuelve SOLO un JSON array (máx 3 items).`,
          },
          {
            role: 'user',
            content: `Con base en estas señales, propone hasta 3 briefs de blog (prioriza valor educativo; máximo un ángulo comercial).

Sectores vistos: ${signals.sectors.join(', ') || 'n/a'}
Ciudades: ${signals.cities.join(', ') || 'Cali'}

Leads recientes (muchos sin web = problema digital):
${signals.leadsSummary || '(sin leads)'}

Oportunidades (empleos/gov/foros):
${signals.opportunitiesSummary || '(sin opps)'}

Knowledge MatuByte:
${knowledge.slice(0, 4500)}

Formato JSON array:
[
  {
    "title": "título tentativo del post",
    "problem": "dolor concreto del negocio",
    "trend": "tendencia o contexto",
    "angle": "ángulo MatuByte / solución software-web-CRM-automatización",
    "city": "ciudad foco",
    "sector": "nicho",
    "priority": 50
  }
]`,
          },
        ],
      });

      const briefs = extractJsonArray(completion.content).slice(0, 3);
      let created = 0;

      for (const brief of briefs) {
        const title = String(brief.title ?? '').trim();
        const angle = String(brief.angle ?? '').trim();
        if (!title || !angle) continue;

        await insertContentBrief({
          source_agent: this.id,
          title,
          problem: String(brief.problem ?? ''),
          trend: String(brief.trend ?? ''),
          angle,
          city: String(brief.city ?? signals.cities[0] ?? 'Cali'),
          sector: String(brief.sector ?? signals.sectors[0] ?? ''),
          priority: Number(brief.priority ?? 60),
          metadata: { model: completion.model },
        });
        created += 1;
      }

      // Fallback: si el LLM no devolvió nada pero hay sectores cazados
      if (created === 0 && signals.sectors.length > 0) {
        const sector = signals.sectors[0]!;
        const city = signals.cities[0] ?? 'Cali';
        await insertContentBrief({
          source_agent: this.id,
          title: `${sector} en ${city} sin presencia web: oportunidad de software`,
          problem: `Negocios de ${sector} operan sin sitio web o con presencia digital débil`,
          trend: 'Digitalización de negocios locales, emprendedores y equipos de servicio',
          angle: `Cómo MatuByte ayuda a ${sector} en ${city} con web, CMR, MatuDB o desarrollo a medida`,
          city,
          sector,
          priority: 55,
        });
        created = 1;
      }

      sendAgentMessage({
        from: 'content-radar',
        to: 'blog-writer',
        topic: 'briefs.ready',
        body: `${created} briefs listos en cola para blogs`,
        payload: { created, sectors: signals.sectors },
      });

      const result: AgentResult = {
        status: created > 0 ? 'ok' : 'skipped',
        reason:
          created > 0
            ? `Encolados ${created} briefs de tendencia/problema`
            : 'Sin señales suficientes para briefs',
        details: { created, sectors: signals.sectors, cities: signals.cities },
      };

      await logAgentRun({
        agent_id: this.id,
        triggered_by: ctx.triggeredBy,
        status: result.status,
        reason: result.reason,
        details: result.details,
        started_at: startedAt,
      }).catch(() => undefined);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', reason: message };
    }
  },
};
