import {
  buildKnowledgeContext,
  getAppBySlug,
  insertContentScript,
  listAppConnections,
} from '../db/growth.js';
import { logAgentRun } from '../db/leads.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
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
    'Genera posts para Instagram/Facebook/TikTok alimentado por tokens/fichas de apps Matu*.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();
    const platform =
      (typeof ctx.params?.platform === 'string' && ctx.params.platform) ||
      'instagram';
    const appSlug =
      typeof ctx.params?.appSlug === 'string' ? ctx.params.appSlug : undefined;

    if (!isLlmConfigured() || envLooksFake(ctx.env.LLM_API_KEY)) {
      return {
        status: 'error',
        reason:
          'LLM_API_KEY inválida. Configura una API key real en .env (ver docs/CONFIGURACION.md)',
      };
    }

    try {
      const app = appSlug
        ? await getAppBySlug(appSlug)
        : (await listAppConnections())[0] ?? null;

      if (!app) {
        return {
          status: 'error',
          reason:
            'No hay app_connections. Crea una con POST /api/apps (token + descripción del producto).',
        };
      }

      pushLog({
        level: 'info',
        agentId: this.id,
        message: `Creating ${platform} content for ${app.name}`,
      });

      const knowledge = await buildKnowledgeContext();
      const features = Array.isArray(app.features)
        ? app.features.join(', ')
        : JSON.stringify(app.features ?? []);

      const completion = await chatCompletion({
        temperature: 0.8,
        maxTokens: 1200,
        messages: [
          {
            role: 'system',
            content:
              'Eres copywriter de MatuByte S.A.S. (Cali). Generas contenido corto para redes, en español, estilo humano, sin emojis excesivos. Devuelve SOLO JSON válido.',
          },
          {
            role: 'user',
            content: `Plataforma: ${platform}
App: ${app.name}
URL: ${app.app_url ?? 'N/A'}
Descripción: ${app.description ?? ''}
Features: ${features}
Brand voice: ${app.brand_voice ?? 'técnico cercano'}
Token conectado: ${app.access_token ? 'sí' : 'no'}

Knowledge empresa:
${knowledge.slice(0, 6000)}

Devuelve JSON:
{
  "hook": "...",
  "script_body": "copy completo del post",
  "seo_copy": "versión corta caption",
  "hashtags": ["..."],
  "topic": "tema central"
}`,
          },
        ],
      });

      const parsed = extractJson(completion.content);
      const topic = String(parsed.topic ?? `${app.name} ${platform}`);
      await insertContentScript({
        platform,
        topic,
        hook: String(parsed.hook ?? ''),
        script_body: String(parsed.script_body ?? completion.content),
        seo_copy: String(parsed.seo_copy ?? ''),
        hashtags: Array.isArray(parsed.hashtags)
          ? parsed.hashtags.map(String)
          : [],
        metadata: {
          app_slug: app.slug,
          app_id: app.id,
          model: completion.model,
        },
      });

      const result: AgentResult = {
        status: 'ok',
        reason: `Contenido ${platform} creado para ${app.slug}`,
        details: { platform, app: app.slug, topic: slugify(topic) },
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

function envLooksFake(key: string): boolean {
  return /smoke|replace_me|changeme|xxx/i.test(key);
}

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { script_body: text, topic: 'contenido' };
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return { script_body: text, topic: 'contenido' };
  }
}
