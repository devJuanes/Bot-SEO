import {
  buildKnowledgeContext,
  getFacebookPublisherSettings,
  insertContentScript,
  listRecentTrendUrls,
  updateContentScriptFb,
} from '../db/growth.js';
import { logAgentRun } from '../db/leads.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import {
  isFacebookConfigured,
  isFacebookDryRun,
  publishRowMedia,
} from '../facebook/client.js';
import {
  fetchTrendingTopics,
  type TrendItem,
} from '../facebook/trends.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';
import type { Agent, AgentContext, AgentResult } from './types.js';
import { pickFacebookImage } from '../knowledge/blog-images.js';
import { resolveFacebookMedia } from '../facebook/images.js';
import { env } from '../config/env.js';
import { EDITORIAL_RULES, pickWeightedPillar } from '../knowledge/editorial.js';
import {
  focusPromptBlock,
  listRecentPillars,
  pickContentFocus,
} from '../knowledge/content-focus.js';

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

export interface FacebookPublisherOptions {
  trendHint?: string;
  trendSource?: 'reddit' | 'news';
  imageUrl?: string;
  forceDryRun?: boolean;
  /** Fuerza publicación inmediata saltando la cola (solo si FB está OK). */
  forceAutoPublish?: boolean;
  appSlug?: string;
  /** Brief / prompt personalizado del usuario (desde project_settings o request). */
  customPrompt?: string;
}

/** Cursor en memoria para no elegir siempre trends[0]. */
let trendCursor = 0;

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
  // Rotación activa/reciente-aware entre el pool fresco (no siempre [0]).
  const idx = trendCursor % trends.length;
  trendCursor += 1;
  return trends[idx] ?? trends[0] ?? null;
}

export const facebookPublisherAgent: Agent = {
  id: 'facebook-publisher',
  name: 'Agente Facebook Publisher',
  description:
    'Detecta tendencias, genera post SEO para Facebook y lo deja en cola de aprobación (manual) o publica (auto).',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();

    if (!(await isLlmConfigured())) {
      return {
        status: 'error',
        reason: 'LLM no configurado para este proyecto',
      };
    }

    const opts = (ctx.params ?? {}) as FacebookPublisherOptions;
    const dryRun = opts.forceDryRun ?? (await isFacebookDryRun());
    const fbSettings = await getFacebookPublisherSettings().catch(() => ({
      mode: 'manual' as const,
      auto_publish: false,
    }));
    const projectCfg = await import('../tenancy/project-config.js')
      .then((m) => m.tryLoadCurrentProjectConfig())
      .catch(() => null);
    const fbEnabled =
      projectCfg?.facebook.enabled ?? ctx.env.FB_PUBLISHER_ENABLED;
    if (!fbEnabled && !opts.forceAutoPublish) {
      return {
        status: 'skipped',
        reason: 'Facebook publisher deshabilitado para este proyecto',
      };
    }
    const autoPublish =
      opts.forceAutoPublish === true ||
      (opts.forceAutoPublish !== false &&
        (projectCfg?.facebook.autoPublish === true ||
          env.FB_AUTO_PUBLISH === true ||
          fbSettings.auto_publish === true ||
          fbSettings.mode === 'auto'));

    if (autoPublish && !dryRun && !(await isFacebookConfigured())) {
      return {
        status: 'error',
        reason:
          'Facebook no configurado: define facebook_page_* secrets o FB_PAGE_* en .env.',
      };
    }

    try {
      pushLog({
        level: 'info',
        agentId: this.id,
        message: autoPublish
          ? dryRun
            ? 'FB Publisher AUTO + DRY-RUN'
            : 'FB Publisher AUTO — publicará en Facebook'
          : 'FB Publisher MANUAL — generará draft en cola /facebook.html',
        details: { dryRun, autoPublish, mode: fbSettings.mode },
      });

      // 1. Tendencias externas (Reddit + Google News)
      const externalTrends = await fetchTrendingTopics({
        source: opts.trendSource,
      }).catch(() => []);
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

      // 3. Foco de producto (rotación activa/reciente — no apps[0] más nuevo)
      const recentPillars = await listRecentPillars(14).catch(() => []);
      const pillar = pickWeightedPillar(recentPillars);
      const focus = await pickContentFocus({
        appSlug: opts.appSlug,
        pillar,
      });
      const appBlock = focus
        ? focusPromptBlock(focus)
        : 'Foco: (sin app_connections ni catálogo — contenido educativo genérico MatuByte)';

      // 4. Signals internas + knowledge
      const { fetchInternalSignals } = await import('../facebook/trends.js');
      const internalSignals = await fetchInternalSignals().catch(() => '');
      const knowledge = await buildKnowledgeContext().catch(() => '');

      let customBrief = opts.customPrompt?.trim() || '';
      if (!customBrief) {
        try {
          const { getTenant } = await import('../tenancy/context.js');
          const { getProjectSetting } = await import('../tenancy/store.js');
          const pid = getTenant()?.projectId ?? null;
          if (pid) {
            const stored = await getProjectSetting<string>(pid, 'facebook_custom_prompt');
            if (typeof stored === 'string') customBrief = stored.trim();
          }
        } catch {
          /* optional */
        }
      }

      // 5. Prompt (sin forzar una image_url fija)
      const completion = await chatCompletion({
        temperature: 0.85,
        maxTokens: 1200,
        messages: [
          {
            role: 'system',
            content: `Eres social media manager SEO de MatuByte S.A.S. (Cali, Colombia · alcance global).
MatuByte crea software a medida, LMS, CRM, finanzas, parking, PDF/email APIs, MatuDB y desarrollo custom. FymApp es aliado DIAN (no propio).

Tu trabajo: convertir UNA tendencia en un post de Facebook listo para aprobar (manual) o publicar, value-first.

${EDITORIAL_RULES}

Reglas de formato:
- Español claro (Colombia), tono experto cercano. Máx 2 emojis.
- Hook ≤90 caracteres con keyword natural cuando encaje.
- Cuerpo 2-4 párrafos: insight útil para emprendedores, developers o público general → opcionalmente 1 mención de producto.
- Incluye 1 pregunta que invite comentario (algoritmo FB).
- CTA suave con matubyte.com solo si el pilar lo permite (máx 1).
- 4–6 hashtags mixtos (marca + nicho + geo suave).
- seo_title ≤60 chars; seo_keywords 3–6 términos de búsqueda.
- image_themes: 3–5 palabras/frases para buscar stock (foto o video). En inglés conviene.
- media_type: "image" | "video" | "auto"
  - usa "video" si el tema se presta a movimiento (demo, automatización, IA, procesos)
  - "image" si es más estático (CRM, tip, guía)
  - "auto" si no estás seguro
- NO inventes URLs de media.
- Pilar sugerido: ${pillar}
- Devuelve SOLO JSON:
  {
    "hook": "...",
    "message": "...",
    "hashtags": ["#uno"],
    "image_themes": ["crm", "sales team", "laptop office"],
    "media_type": "auto",
    "topic": "tema corto",
    "seo_title": "...",
    "seo_keywords": ["software a medida", "emprendimiento Colombia", "desarrollo web"]
  }
- "message" = post completo (hook + cuerpo + CTA opcional + hashtags al final).`,
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

${customBrief ? `BRIEF PERSONALIZADO DEL USUARIO (prioridad alta):\n${customBrief}\n` : ''}
Señales internas MatuByte (para anclar el post a clientes reales):
${internalSignals.slice(0, 3500)}

Knowledge empresa:
${knowledge.slice(0, 5000)}

Devuelve SOLO JSON.`,
          },
        ],
      });

      const parsed = extractJson(completion.content);
      const hook = String(parsed.hook ?? '').trim();
      let message = String(parsed.message ?? completion.content).trim();
      // Si el LLM devolvió JSON crudo como cuerpo, intenta recuperar message
      if (message.startsWith('```') || message.trimStart().startsWith('{')) {
        const inner = extractJson(message);
        if (typeof inner.message === 'string' && inner.message.trim()) {
          message = String(inner.message).trim();
        }
      }
      const topic = String(parsed.topic ?? trend.title).trim();
      const hashtags = Array.isArray(parsed.hashtags)
        ? (parsed.hashtags as unknown[]).map(String).filter(Boolean)
        : [];
      const seoTitle = String(parsed.seo_title ?? topic).trim().slice(0, 200);
      const seoKeywords = Array.isArray(parsed.seo_keywords)
        ? (parsed.seo_keywords as unknown[]).map(String).filter(Boolean)
        : [];
      const imageThemes = Array.isArray(parsed.image_themes)
        ? (parsed.image_themes as unknown[]).map(String).filter(Boolean)
        : seoKeywords;
      const mediaPreferRaw = String(parsed.media_type ?? 'auto')
        .trim()
        .toLowerCase();
      const mediaPrefer =
        mediaPreferRaw === 'video' || mediaPreferRaw === 'image'
          ? mediaPreferRaw
          : ('auto' as const);

      // 6. Media alineada al copy: foto o video (Pexels) / fallback imagen local
      const fallbackImage = isValidUrl(opts.imageUrl)
        ? opts.imageUrl
        : pickFacebookImage({
            topic,
            hook,
            message,
            hashtags,
            imageThemes,
            trendTitle: trend.title,
          }).url;

      const media = await resolveFacebookMedia({
        prefer: mediaPrefer,
        themes: imageThemes,
        topic,
        seed: `${topic}|${trend.url}`,
        fallbackImageUrl: fallbackImage,
      });

      // 7. INSERT — pending_review si manual; draft+publish si auto
      const initialStatus = autoPublish ? 'draft' : 'pending_review';
      const rowId = await insertContentScript({
        platform: 'facebook',
        topic,
        hook,
        script_body: message,
        hashtags,
        seo_title: seoTitle,
        seo_keywords: seoKeywords,
        // Guardamos URL principal aquí (foto o mp4); el tipo va en metadata
        fb_photo_url: media.url,
        trend_source: trend.source,
        trend_url: trend.url,
        publish_status: initialStatus,
        metadata: {
          app_slug: focus?.slug ?? null,
          product_slug: focus?.slug ?? null,
          catalog_slug: focus?.slug ?? null,
          audience_pillar: pillar,
          ownership: focus?.ownership ?? null,
          focus_source: focus?.source ?? null,
          trend_summary: trend.summary ?? null,
          model: completion.model,
          usage: completion.usage ?? null,
          generated_by: 'facebook-publisher',
          approval_mode: autoPublish ? 'auto' : 'manual',
          media_type: media.mediaType,
          media_thumb: media.thumbUrl ?? null,
          image_themes: imageThemes,
        },
      });

      if (!rowId) {
        pushLog({
          level: 'warn',
          agentId: this.id,
          message: 'INSERT content_script no devolvió id; se aborta',
        });
        return {
          status: 'error',
          reason: 'No se pudo persistir el draft (INSERT devolvió vacío)',
        };
      }

      // Manual: cola de aprobación — no publica
      if (!autoPublish) {
        sendAgentMessage({
          from: 'facebook-publisher',
          to: 'broadcast',
          topic: 'facebook.pending_review',
          body: `Post listo para aprobar: ${topic}`,
          payload: { rowId, topic, trend: trend.title },
        });

        await logAgentRun({
          agent_id: this.id,
          triggered_by: ctx.triggeredBy,
          status: 'ok',
          reason: `Draft en cola pending_review: "${topic}"`,
          details: { rowId, topic: slugify(topic), autoPublish: false },
          started_at: startedAt,
        }).catch(() => undefined);

        return {
          status: 'ok',
          reason: `Post en cola de aprobación (/facebook.html): "${topic}"`,
          details: {
            rowId,
            topic: slugify(topic),
            trend: trend.title,
            publish_status: 'pending_review',
            autoPublish: false,
          },
        };
      }

      pushLog({
        level: 'info',
        agentId: this.id,
        message: `Draft FB guardado (row=${rowId}), intentando publicar…`,
      });

      // 8. Publicar (modo auto)
      let publishResult;
      try {
        publishResult = await publishRowMedia(
          {
            script_body: message,
            fb_photo_url: media.url,
            metadata: { media_type: media.mediaType },
          },
          { dryRun },
        );
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
          withPhoto: media.mediaType === 'image',
          withVideo: media.mediaType === 'video',
          mediaType: media.mediaType,
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
