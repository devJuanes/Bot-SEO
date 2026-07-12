import {
  buildKnowledgeContext,
  getAppBySlug,
  insertContentScript,
  listAppConnections,
  listRecentTrendUrls,
  updateContentScriptFb,
} from '../db/growth.js';
import { logAgentRun } from '../db/leads.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import {
  isFacebookConfigured,
  isFacebookDryRun,
  publishDryRun,
  publishFeedPost,
  publishPhotoPost,
  publishWithRetry,
} from '../facebook/client.js';
import {
  fetchTrendingTopics,
  type TrendItem,
} from '../facebook/trends.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';
import type { Agent, AgentContext, AgentResult } from './types.js';
import { pickCoverImage } from '../knowledge/blog-images.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function envLooksFake(key: string | undefined): boolean {
  if (!key) return true;
  return /smoke|replace_me|changeme|xxx/i.test(key);
}

export interface FacebookPublisherOptions {
  trendHint?: string;
  trendSource?: 'reddit' | 'news';
  imageUrl?: string;
  forceDryRun?: boolean;
  appSlug?: string;
}

function pickTrend(
  trends: TrendItem[],
  hint: string | undefined,
): TrendItem | null {
  if (!trends.length) return null;
  if (hint) {
    const lower = hint.toLowerCase();
    const exact = trends.find((t) => t.title.toLowerCase() === lower);
    if (exact) return exact;
    const partial = trends.find((t) => t.title.toLowerCase().includes(lower));
    if (partial) return partial;
  }
  // Round-robin simple: prioriza news sobre reddit por orden de inserción.
  return trends[0];
}

export const facebookPublisherAgent: Agent = {
  id: 'facebook-publisher',
  name: 'Agente Facebook Publisher',
  description:
    'Detecta tendencias (Reddit/Google News/llamadas internas), genera post y publica directo en página de Facebook vía Meta Graph.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();

    if (!isLlmConfigured() || envLooksFake(ctx.env.LLM_API_KEY)) {
      return {
        status: 'error',
        reason: 'LLM_API_KEY inválida. Configura una API key real en .env.',
      };
    }

    if (!ctx.env.FB_PUBLISHER_ENABLED) {
      return {
        status: 'skipped',
        reason: 'FB_PUBLISHER_ENABLED=false en .env',
      };
    }

    const opts = (ctx.params ?? {}) as FacebookPublisherOptions;
    const dryRun = opts.forceDryRun ?? isFacebookDryRun();

    if (!dryRun && !isFacebookConfigured()) {
      return {
        status: 'error',
        reason: 'Facebook no configurado: define FB_PAGE_ID y FB_PAGE_ACCESS_TOKEN en .env o usa FB_DRY_RUN=true.',
      };
    }

    try {
      pushLog({
        level: 'info',
        agentId: this.id,
        message: dryRun
          ? 'FB Publisher en modo DRY-RUN (no publica de verdad)'
          : 'FB Publisher publicará en la página real de Facebook',
        details: { dryRun },
      });

      // 1. Tendencias externas (Reddit + Google News)
      const externalTrends = await fetchTrendingTopics().catch(() => []);
      pushLog({
        level: 'info',
        agentId: this.id,
        message: `Trends externos detectados: ${externalTrends.length}`,
        details: {
          sample: externalTrends.slice(0, 3).map((t) => `${t.source}:${t.title}`),
        },
      });

      // 2. Filtrar por trend_url ya usado en últimos 7 días
      const recentUrls = new Set(await listRecentTrendUrls(7).catch(() => []));
      const fresh = externalTrends.filter((t) => !recentUrls.has(t.url));

      const trend =
        pickTrend(opts.trendHint ? externalTrends : fresh, opts.trendHint) ??
        pickTrend(externalTrends, opts.trendHint);
      if (!trend) {
        return {
          status: 'skipped',
          reason: `Sin tendencias disponibles (${externalTrends.length} crudas, ${fresh.length} nuevas)`,
        };
      }

      // 3. Imagen pública opcional
      const imageUrl =
        (isValidUrl(opts.imageUrl) ? opts.imageUrl : null) ??
        pickCoverImage({
          sector: 'redes sociales',
          keywords: [trend.title],
          title: trend.title,
        }).url;

      // 4. App foco (primer app_connections activo o appSlug explícito)
      const app = opts.appSlug
        ? await getAppBySlug(opts.appSlug).catch(() => null)
        : (await listAppConnections().catch(() => []))[0] ?? null;
      const appBlock = app
        ? `App foco: ${app.name} (${app.app_url ?? 'N/A'})\nBrand voice: ${app.brand_voice ?? 'técnico cercano'}\nDescription: ${app.description ?? ''}`
        : 'App foco: (sin app_connections registradas)';

      // 5. Signals internas + knowledge
      const { fetchInternalSignals } = await import('../facebook/trends.js');
      const internalSignals = await fetchInternalSignals().catch(() => '');
      const knowledge = await buildKnowledgeContext().catch(() => '');

      // 6. Prompt
      const completion = await chatCompletion({
        temperature: 0.85,
        maxTokens: 1200,
        messages: [
          {
            role: 'system',
            content: `Eres social media manager de MatuByte S.A.S. (Cali, Colombia).
MatuByte crea software a medida, apps web/móvil, CRM, automatizaciones y herramientas SEO para PYMES colombianas y LatAm.

Tu trabajo: convertir UNA tendencia detectada en un post de Facebook listo para publicar.

Reglas:
- Escribe en español colombiano natural, sin emojis excesivos (máx 2 bien puestos).
- Hook en la primera línea (≤90 caracteres, gancho real, no clickbait).
- Cuerpo: 2-4 párrafos cortos, conecta la tendencia con un dolor real de PYMES y deja una puerta abierta a MatuByte (sin vender agresivo).
- CTA suave al final (ej: "Conversemos → matubyte.com" o "Te leemos en comentarios").
- 3 a 5 hashtags en español, relevantes al tema.
- Devuelve SOLO JSON válido con esta forma exacta:
  { "hook": "...", "message": "...", "hashtags": ["#uno"], "image_url": "", "topic": "tema corto" }
- "message" = texto completo del post (incluye hook al inicio y CTA al final).`,
          },
          {
            role: 'user',
            content: `Tendencia detectada:
- Fuente: ${trend.source} (${trend.source})
- Título: ${trend.title}
- URL: ${trend.url}
- Resumen: ${trend.summary ?? 'n/a'}
- Publicado: ${trend.publishedAt ?? 'n/a'}

${appBlock}

Señales internas MatuByte (para anclar el post a clientes reales):
${internalSignals.slice(0, 3500)}

Knowledge empresa:
${knowledge.slice(0, 5000)}

¿Hay imageUrl sugerida? ${
              isValidUrl(imageUrl) ? `Sí: ${imageUrl}. Devuélvela en image_url.` : 'No. Devuelve image_url vacío (post solo texto).'
            }

Devuelve SOLO JSON.`,
          },
        ],
      });

      const parsed = extractJson(completion.content);
      const hook = String(parsed.hook ?? '').trim();
      const message = String(parsed.message ?? completion.content).trim();
      const topic = String(parsed.topic ?? trend.title).trim();
      const hashtags = Array.isArray(parsed.hashtags)
        ? (parsed.hashtags as unknown[]).map(String).filter(Boolean)
        : [];
      const llmImageUrl = isValidUrl(parsed.image_url) ? parsed.image_url : null;
      const finalPhotoUrl = llmImageUrl ?? (isValidUrl(imageUrl) ? imageUrl : null);

      // 7. INSERT draft
      const rowId = await insertContentScript({
        platform: 'facebook',
        topic,
        hook,
        script_body: message,
        hashtags,
        fb_photo_url: finalPhotoUrl,
        trend_source: trend.source,
        trend_url: trend.url,
        publish_status: 'draft',
        metadata: {
          app_slug: app?.slug ?? null,
          trend_summary: trend.summary ?? null,
          model: completion.model,
          usage: completion.usage ?? null,
          generated_by: 'facebook-publisher',
        },
      });

      if (!rowId) {
        pushLog({
          level: 'warn',
          agentId: this.id,
          message: 'INSERT content_script no devolvió id; se aborta publish',
        });
        return {
          status: 'error',
          reason: 'No se pudo persistir el draft (INSERT devolvió vacío)',
        };
      }

      pushLog({
        level: 'info',
        agentId: this.id,
        message: `Draft FB guardado (row=${rowId}), intentando publicar…`,
      });

      // 8. Publicar
      const publish = async () => {
        if (dryRun) {
          return publishDryRun(finalPhotoUrl ? 'photos' : 'feed', {
            message,
            imageUrl: finalPhotoUrl ?? undefined,
          });
        }
        if (finalPhotoUrl) {
          return publishWithRetry(() => publishPhotoPost(finalPhotoUrl, message), 'fb-photo');
        }
        return publishWithRetry(() => publishFeedPost(message), 'fb-feed');
      };

      let publishResult;
      try {
        publishResult = await publish();
      } catch (publishErr) {
        const errorMsg =
          publishErr instanceof Error ? publishErr.message : String(publishErr);
        await updateContentScriptFb(rowId, {
          publish_status: 'failed',
          error_message: errorMsg.slice(0, 1000),
        }).catch(() => undefined);

        sendAgentMessage({
          from: 'facebook-publisher',
          to: 'broadcast',
          topic: 'facebook.failed',
          body: `FB falló: ${topic} (${errorMsg.slice(0, 120)})`,
          payload: { rowId, trend: trend.title, error: errorMsg },
        });

        await logAgentRun({
          agent_id: this.id,
          triggered_by: ctx.triggeredBy,
          status: 'error',
          reason: `Publicación FB falló: ${errorMsg.slice(0, 200)}`,
          details: { rowId, trend: trend.title, topic: slugify(topic) },
          started_at: startedAt,
        }).catch(() => undefined);

        return {
          status: 'error',
          reason: `Publicación FB falló: ${errorMsg}`,
          details: { rowId, topic: slugify(topic), trend: trend.title },
        };
      }

      // 9. UPDATE row con éxito
      const publishedAt = new Date().toISOString();
      await updateContentScriptFb(rowId, {
        fb_post_id: publishResult.fbPostId ?? undefined,
        fb_permalink_url: publishResult.fbPermalinkUrl ?? undefined,
        fb_published_at: publishedAt,
        publish_status: 'published',
      }).catch(() => undefined);

      const result: AgentResult = {
        status: 'ok',
        reason: dryRun
          ? `FB dry-run OK para "${topic}"`
          : `FB publicado: "${topic}"`,
        details: {
          rowId,
          topic: slugify(topic),
          trend: trend.title,
          trend_source: trend.source,
          fb_post_id: publishResult.fbPostId ?? undefined,
          fb_permalink_url: publishResult.fbPermalinkUrl ?? undefined,
          dryRun,
          withPhoto: Boolean(finalPhotoUrl),
        },
      };

      sendAgentMessage({
        from: 'facebook-publisher',
        to: 'broadcast',
        topic: 'facebook.published',
        body: `${dryRun ? 'DRY-RUN' : 'Publicado'}: ${topic}`,
        payload: result.details,
      });

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
