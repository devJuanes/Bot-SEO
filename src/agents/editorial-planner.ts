import {
  buildKnowledgeContext,
  insertContentBrief,
} from '../db/growth.js';
import { logAgentRun } from '../db/leads.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import {
  EDITORIAL_RULES,
  diversifyPillarBatch,
  pillarLabel,
  shouldIncludeProductCta,
  pickCatalogProduct,
} from '../knowledge/editorial.js';
import {
  listRecentFocusSlugs,
  listRecentPillars,
} from '../knowledge/content-focus.js';
import { formatCatalogForPrompt } from '../knowledge/product-catalog.js';
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

/**
 * Planificador editorial: lote diversificado de briefs (mayoría educativa,
 * ≤1 comercial/CTA) para aprobación manual. No publica.
 */
export const editorialPlannerAgent: Agent = {
  id: 'editorial-planner',
  name: 'Agente Planificador Editorial',
  description:
    'Planifica briefs diversificados por audiencia/pilar, rota productos y evita repetición reciente. Solo cola manual.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();
    const batchSize = Math.min(
      5,
      Math.max(2, Number(ctx.params?.batchSize ?? 3) || 3),
    );

    if (!(await isLlmConfigured())) {
      return {
        status: 'error',
        reason: 'LLM no configurado para este proyecto',
      };
    }

    try {
      const recentSlugs = await listRecentFocusSlugs(14).catch(() => []);
      const recentPillars = await listRecentPillars(14).catch(() => []);
      const pillars = diversifyPillarBatch(batchSize, recentPillars);

      const planSlots = pillars.map((pillar) => {
        const includeCta = shouldIncludeProductCta(pillar);
        const product = includeCta
          ? pickCatalogProduct({
              recentSlugs,
              pillar,
              allowPartner: pillar === 'commercial' || pillar === 'use_cases',
            })
          : null;
        return { pillar, includeCta, product };
      });

      // Garantiza a lo sumo un slot con producto/CTA comercial
      let ctaCount = 0;
      for (const slot of planSlots) {
        if (slot.includeCta && slot.product) {
          ctaCount += 1;
          if (ctaCount > 1) {
            slot.includeCta = false;
            slot.product = null;
          }
        }
      }

      pushLog({
        level: 'info',
        agentId: this.id,
        message: `Plan editorial: ${planSlots.length} slots`,
        details: {
          pillars: planSlots.map((s) => s.pillar),
          products: planSlots.map((s) => s.product?.slug ?? null),
        },
      });

      const knowledge = await buildKnowledgeContext().catch(() => '');
      const slotBrief = planSlots
        .map((s, i) => {
          const prod = s.product
            ? `producto opcional: ${s.product.name} (${s.product.slug}) [${s.product.ownership}]`
            : 'sin producto — solo valor';
          return `${i + 1}. Pilar=${s.pillar} (${pillarLabel(s.pillar)}); CTA=${s.includeCta ? 'sí (máx 1)' : 'no'}; ${prod}`;
        })
        .join('\n');

      const completion = await chatCompletion({
        temperature: 0.8,
        maxTokens: 2000,
        messages: [
          {
            role: 'system',
            content: `Eres el Planificador Editorial de MatuByte S.A.S. (Cali).
${EDITORIAL_RULES}
Devuelve SOLO un JSON array (exactamente ${planSlots.length} items).`,
          },
          {
            role: 'user',
            content: `Genera ${planSlots.length} briefs para cola manual (blog/redes). No publiques.

Slots obligatorios:
${slotBrief}

Catálogo veraz:
${formatCatalogForPrompt()}

Evitar slugs recientes: ${recentSlugs.join(', ') || '(ninguno)'}
Pilares recientes: ${recentPillars.join(', ') || '(ninguno)'}

Knowledge:
${knowledge.slice(0, 4000)}

Formato:
[
  {
    "title": "",
    "problem": "",
    "trend": "",
    "angle": "",
    "city": "Cali",
    "sector": "",
    "audience_pillar": "education",
    "product_slug": null,
    "include_cta": false,
    "channel": "blog|social|either",
    "priority": 50
  }
]`,
          },
        ],
      });

      const briefs = extractJsonArray(completion.content).slice(0, planSlots.length);
      let created = 0;
      let productMentions = 0;

      for (let i = 0; i < briefs.length; i += 1) {
        const brief = briefs[i]!;
        const slot = planSlots[i]!;
        const title = String(brief.title ?? '').trim();
        const angle = String(brief.angle ?? '').trim();
        if (!title || !angle) continue;

        let productSlug =
          typeof brief.product_slug === 'string' && brief.product_slug
            ? brief.product_slug
            : slot.product?.slug ?? null;
        let includeCta =
          brief.include_cta === true || slot.includeCta === true;

        if (includeCta && productSlug) {
          if (productMentions >= 1) {
            includeCta = false;
            productSlug = null;
          } else {
            productMentions += 1;
          }
        } else {
          includeCta = false;
          if (!slot.includeCta) productSlug = null;
        }

        const pillar =
          (typeof brief.audience_pillar === 'string' && brief.audience_pillar) ||
          slot.pillar;

        await insertContentBrief({
          source_agent: this.id,
          title,
          problem: String(brief.problem ?? ''),
          trend: String(brief.trend ?? ''),
          angle,
          city: String(brief.city ?? 'Cali'),
          sector: String(brief.sector ?? slot.product?.name ?? ''),
          priority: Number(brief.priority ?? 50 + (includeCta ? 5 : 0)),
          metadata: {
            audience_pillar: pillar,
            product_slug: productSlug,
            catalog_slug: productSlug,
            include_cta: includeCta,
            channel: String(brief.channel ?? 'either'),
            generated_by: 'editorial-planner',
            model: completion.model,
            ownership: slot.product?.ownership ?? null,
          },
        });
        created += 1;
      }

      // Fallback sin LLM: briefs educativos mínimos
      if (created === 0) {
        for (const slot of planSlots.slice(0, 2)) {
          const product = slot.product;
          await insertContentBrief({
            source_agent: this.id,
            title: slot.includeCta && product
              ? `Cómo ${product.name} encaja en ${pillarLabel(slot.pillar)}`
              : `Guía práctica: ${pillarLabel(slot.pillar)} para negocios digitales`,
            problem: 'Falta de contenido diversificado y educativo en canales MatuByte',
            trend: 'Contenido value-first vs spam de producto',
            angle: slot.includeCta && product
              ? `Explicar el problema real y mencionar una sola vez ${product.name}${product.ownership === 'partner' ? ' (aliado, no producto MatuByte)' : ''}`
              : 'Enseñar un concepto útil sin pitch de producto',
            city: 'Cali',
            sector: product?.name ?? 'educación digital',
            priority: 52,
            metadata: {
              audience_pillar: slot.pillar,
              product_slug: slot.includeCta ? product?.slug ?? null : null,
              include_cta: Boolean(slot.includeCta && product),
              generated_by: 'editorial-planner',
              fallback: true,
            },
          });
          created += 1;
        }
      }

      sendAgentMessage({
        from: 'editorial-planner',
        to: 'broadcast',
        topic: 'editorial.plan',
        body: `${created} briefs editoriales en cola (manual)`,
        payload: {
          created,
          pillars: planSlots.map((s) => s.pillar),
          productMentions,
        },
      });
      sendAgentMessage({
        from: 'editorial-planner',
        to: 'blog-writer',
        topic: 'briefs.ready',
        body: `${created} briefs del planificador listos`,
        payload: { created },
      });

      const result: AgentResult = {
        status: created > 0 ? 'ok' : 'skipped',
        reason:
          created > 0
            ? `Encolados ${created} briefs diversificados (CTA productos=${productMentions})`
            : 'No se generaron briefs',
        details: {
          created,
          pillars: planSlots.map((s) => s.pillar),
          productMentions,
        },
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
