import {
  buildKnowledgeContext,
  insertContentScript,
} from '../db/growth.js';
import { logAgentRun } from '../db/leads.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import { EDITORIAL_RULES, pickWeightedPillar } from '../knowledge/editorial.js';
import {
  focusPromptBlock,
  listRecentPillars,
  pickContentFocus,
} from '../knowledge/content-focus.js';
import { pushLog } from '../runtime/state.js';
import type { Agent, AgentContext, AgentResult } from './types.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export const socialCreatorAgent: Agent = {
  id: 'social-creator',
  name: 'Agente Creador de Contenido',
  description:
    'Genera posts para Instagram/Facebook/TikTok rotando catálogo / app_connections activas (no solo la más nueva).',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();
    const platform =
      (typeof ctx.params?.platform === 'string' && ctx.params.platform) ||
      'instagram';
    const appSlug =
      typeof ctx.params?.appSlug === 'string' ? ctx.params.appSlug : undefined;

    if (!(await isLlmConfigured())) {
      return {
        status: 'error',
        reason: 'LLM no configurado para este proyecto',
      };
    }

    try {
      const recentPillars = await listRecentPillars(14).catch(() => []);
      const pillar = pickWeightedPillar(recentPillars);
      const focus = await pickContentFocus({ appSlug, pillar });

      if (!focus) {
        return {
          status: 'error',
          reason:
            'Sin foco de contenido: catálogo vacío y no hay app_connections activas.',
        };
      }

      pushLog({
        level: 'info',
        agentId: this.id,
        message: `Creating ${platform} content for ${focus.name} (${focus.source})`,
        details: { slug: focus.slug, pillar },
      });

      const knowledge = await buildKnowledgeContext();

      const completion = await chatCompletion({
        temperature: 0.8,
        maxTokens: 1200,
        messages: [
          {
            role: 'system',
            content: `Eres copywriter de MatuByte S.A.S. (Cali). Generas contenido corto para redes, en español, estilo humano, sin emojis excesivos.
${EDITORIAL_RULES}
Devuelve SOLO JSON válido.`,
          },
          {
            role: 'user',
            content: `Plataforma: ${platform}
Pilar de audiencia: ${pillar}
Token/app_connection: ${focus.accessToken ? 'sí' : 'no (catálogo estático OK)'}

${focusPromptBlock(focus)}

Knowledge empresa:
${knowledge.slice(0, 6000)}

Devuelve JSON:
{
  "hook": "...",
  "script_body": "copy completo del post (máx 1 mención de producto/CTA)",
  "seo_copy": "versión corta caption",
  "hashtags": ["..."],
  "topic": "tema central"
}`,
          },
        ],
      });

      const parsed = extractJson(completion.content);
      const topic = String(parsed.topic ?? `${focus.name} ${platform}`);
      await insertContentScript({
        platform,
        topic,
        hook: String(parsed.hook ?? ''),
        script_body: String(parsed.script_body ?? completion.content),
        seo_copy: String(parsed.seo_copy ?? ''),
        hashtags: Array.isArray(parsed.hashtags)
          ? parsed.hashtags.map(String)
          : [],
        publish_status: 'draft',
        metadata: {
          app_slug: focus.slug,
          product_slug: focus.slug,
          catalog_slug: focus.slug,
          app_id: focus.appId ?? null,
          audience_pillar: pillar,
          ownership: focus.ownership,
          focus_source: focus.source,
          model: completion.model,
          generated_by: 'social-creator',
        },
      });

      const result: AgentResult = {
        status: 'ok',
        reason: `Contenido ${platform} creado para ${focus.slug}`,
        details: {
          platform,
          app: focus.slug,
          pillar,
          topic: slugify(topic),
          source: focus.source,
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

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { script_body: text, topic: 'contenido' };
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return { script_body: text, topic: 'contenido' };
  }
}
