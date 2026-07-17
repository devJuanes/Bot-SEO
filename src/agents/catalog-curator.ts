import {
  buildKnowledgeContext,
  insertContentBrief,
  insertContentScript,
} from '../db/growth.js';
import { logAgentRun } from '../db/leads.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import {
  EDITORIAL_RULES,
  pickWeightedPillar,
  pillarLabel,
  shouldIncludeProductCta,
} from '../knowledge/editorial.js';
import {
  listRecentFocusSlugs,
  listRecentPillars,
  pickContentFocus,
  focusPromptBlock,
} from '../knowledge/content-focus.js';
import { formatCatalogForPrompt } from '../knowledge/product-catalog.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';
import type { Agent, AgentContext, AgentResult } from './types.js';

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Curador de catálogo: rota productos/aliados, evita repetición reciente y
 * genera brief + draft social en cola (manual approval). No publica.
 */
export const catalogCuratorAgent: Agent = {
  id: 'catalog-curator',
  name: 'Agente Curador de Catálogo',
  description:
    'Rota productos del catálogo MatuByte (+ aliado FymApp), evita repetición y deja briefs/drafts para aprobación manual.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();

    if (!isLlmConfigured() || /smoke|replace_me|changeme|xxx/i.test(ctx.env.LLM_API_KEY)) {
      return {
        status: 'error',
        reason: 'LLM_API_KEY inválida para catalog-curator',
      };
    }

    try {
      const recentSlugs = await listRecentFocusSlugs(14).catch(() => []);
      const recentPillars = await listRecentPillars(14).catch(() => []);
      const pillar = pickWeightedPillar(recentPillars);
      const includeCta = shouldIncludeProductCta(pillar);
      const focus = await pickContentFocus({
        pillar,
        allowPartner: pillar === 'commercial' || pillar === 'use_cases' || pillar === 'entrepreneurs',
      });

      if (!focus) {
        return { status: 'skipped', reason: 'Sin foco de catálogo disponible' };
      }

      pushLog({
        level: 'info',
        agentId: this.id,
        message: `Curando ${focus.name} · pilar ${pillar} · CTA=${includeCta}`,
        details: { slug: focus.slug, recentSlugs },
      });

      const knowledge = await buildKnowledgeContext().catch(() => '');
      const completion = await chatCompletion({
        temperature: 0.75,
        maxTokens: 1400,
        messages: [
          {
            role: 'system',
            content: `Eres el Curador de Catálogo editorial de MatuByte S.A.S. (Cali).
${EDITORIAL_RULES}
Devuelve SOLO JSON válido.`,
          },
          {
            role: 'user',
            content: `Crea UN brief editorial + draft corto para redes (cola de aprobación manual, NO publicar).

Pilar de audiencia: ${pillar} (${pillarLabel(pillar)})
Incluir mención de producto/CTA: ${includeCta ? 'sí, máximo uno suave' : 'no — solo valor educativo'}

${focusPromptBlock(focus)}

Catálogo completo (referencia veraz):
${formatCatalogForPrompt()}

Knowledge (recorte):
${knowledge.slice(0, 4000)}

Slugs recientes a evitar: ${recentSlugs.join(', ') || '(ninguno)'}

JSON:
{
  "title": "título del brief",
  "problem": "dolor o pregunta del público",
  "trend": "contexto o tendencia",
  "angle": "ángulo educativo o de uso (sin hard-sell)",
  "hook": "gancho redes ≤90 chars",
  "script_body": "copy del post (2-4 párrafos). Si CTA=no, cero pitch de producto.",
  "seo_copy": "caption corto",
  "hashtags": ["#uno"],
  "topic": "tema central",
  "priority": 55
}`,
          },
        ],
      });

      const parsed = extractJson(completion.content);
      const title = String(parsed.title ?? `${focus.name}: ${pillar}`).trim();
      const angle = String(parsed.angle ?? '').trim();
      if (!title || !angle) {
        return {
          status: 'error',
          reason: 'LLM no devolvió title/angle válidos',
        };
      }

      const metaBase = {
        product_slug: focus.slug,
        catalog_slug: focus.slug,
        app_slug: focus.slug,
        audience_pillar: pillar,
        include_cta: includeCta,
        ownership: focus.ownership,
        generated_by: 'catalog-curator',
        model: completion.model,
      };

      await insertContentBrief({
        source_agent: this.id,
        title,
        problem: String(parsed.problem ?? ''),
        trend: String(parsed.trend ?? ''),
        angle,
        city: 'Cali',
        sector: focus.name,
        priority: Number(parsed.priority ?? 55),
        metadata: metaBase,
      });

      const platform =
        (typeof ctx.params?.platform === 'string' && ctx.params.platform) ||
        'facebook';
      const hook = String(parsed.hook ?? '').trim();
      const scriptBody = String(parsed.script_body ?? '').trim();
      let scriptId: string | null = null;
      if (scriptBody) {
        scriptId = await insertContentScript({
          platform,
          topic: String(parsed.topic ?? title),
          hook,
          script_body: scriptBody,
          seo_copy: String(parsed.seo_copy ?? ''),
          hashtags: Array.isArray(parsed.hashtags)
            ? parsed.hashtags.map(String)
            : [],
          publish_status: 'pending_review',
          metadata: {
            ...metaBase,
            approval_mode: 'manual',
            auto_publish: false,
          },
        });
      }

      sendAgentMessage({
        from: 'catalog-curator',
        to: 'editorial-planner',
        topic: 'catalog.curated',
        body: `Brief+draft listos: ${title} (${focus.slug} / ${pillar})`,
        payload: { title, slug: focus.slug, pillar, scriptId },
      });

      const result: AgentResult = {
        status: 'ok',
        reason: `Curado ${focus.slug} · pilar ${pillar} · draft=${scriptId ? 'pending_review' : 'brief-only'}`,
        details: {
          slug: focus.slug,
          pillar,
          includeCta,
          scriptId,
          ownership: focus.ownership,
        },
      };

      await logAgentRun({
        agent_id: this.id,
        triggered_by: ctx.triggeredBy,
        status: 'ok',
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
