import {
  buildKnowledgeContext,
  claimNextContentBrief,
  completeContentBrief,
  insertBlogPost,
} from '../db/growth.js';
import { logAgentRun } from '../db/leads.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import { getMatuByteSummary } from '../knowledge/matubyte.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';
import type { Agent, AgentContext, AgentResult } from './types.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { title: 'Artículo MatuByte', content_markdown: text };
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return { title: 'Artículo MatuByte', content_markdown: text };
  }
}

export const blogWriterAgent: Agent = {
  id: 'blog-writer',
  name: 'Agente Redactor de Blogs',
  description:
    'Toma briefs de tendencias/problemas del Radar (o params manuales) y escribe artículos SEO.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();
    const brand = getMatuByteSummary();

    if (!isLlmConfigured() || /smoke|replace_me/i.test(ctx.env.LLM_API_KEY)) {
      return {
        status: 'error',
        reason: 'Configura LLM_API_KEY real para generar blogs',
      };
    }

    let briefId: string | null = null;

    try {
      // 1) Manual override
      let topic =
        typeof ctx.params?.topic === 'string' ? ctx.params.topic : null;
      let city =
        typeof ctx.params?.city === 'string' ? ctx.params.city : null;
      let problem =
        typeof ctx.params?.problem === 'string' ? ctx.params.problem : null;
      let trend =
        typeof ctx.params?.trend === 'string' ? ctx.params.trend : null;
      let angle =
        typeof ctx.params?.angle === 'string' ? ctx.params.angle : null;
      let sector: string | null = null;

      // 2) Auto: claim next pending brief from Radar / Hunter
      if (!topic) {
        const brief = await claimNextContentBrief();
        if (brief) {
          briefId = brief.id;
          topic = brief.title;
          city = brief.city;
          problem = brief.problem;
          trend = brief.trend;
          angle = brief.angle;
          sector = brief.sector;
          pushLog({
            level: 'info',
            agentId: this.id,
            message: `Brief reclamado · ${brief.title}`,
          });
        }
      }

      if (!topic) {
        return {
          status: 'skipped',
          reason:
            'No hay briefs pendientes. El Radar debe detectar tendencias/problemas primero.',
        };
      }

      city = city || 'Cali';

      pushLog({
        level: 'info',
        agentId: this.id,
        message: `Escribiendo blog desde problema/tendencia · ${topic}`,
      });

      const knowledge = await buildKnowledgeContext();
      const completion = await chatCompletion({
        temperature: 0.65,
        maxTokens: 2800,
        messages: [
          {
            role: 'system',
            content: `Eres redactor SEO de ${brand.company} (${brand.hq}).
Escribes en español colombiano, útil y concreto, para emprendedores, developers, educadores y público general (no solo PYMES).
El artículo debe partir del PROBLEMA/TENDENCIA real y conectar con soluciones MatuByte cuando aporte valor (web, app, CMR, MatuDB, automatización, LMS). FymApp solo como aliado DIAN si aplica.
Máximo un CTA de producto. Devuelve JSON.`,
          },
          {
            role: 'user',
            content: `Brief de contenido:
- Título guía: ${topic}
- Problema: ${problem || 'n/a'}
- Tendencia: ${trend || 'n/a'}
- Ángulo MatuByte: ${angle || 'software a medida / digitalización'}
- Sector: ${sector || 'general'}
- Ciudad foco: ${city}
- CTA WhatsApp: ${ctx.env.WHATSAPP_CTA_URL ?? 'configurar WHATSAPP_CTA_URL'}

Knowledge:
${knowledge.slice(0, 6500)}

JSON:
{
  "title": "",
  "excerpt": "",
  "seo_title": "",
  "seo_description": "",
  "seo_keywords": [],
  "content_markdown": "artículo completo en markdown con H2/H3, problema → solución → CTA"
}`,
          },
        ],
      });

      const parsed = extractJson(completion.content);
      const title = String(parsed.title ?? topic);
      const slug = `${slugify(title)}-${Date.now().toString(36)}`;
      const publishImmediately = ctx.params?.publish === true;

      await insertBlogPost({
        title,
        slug,
        excerpt: String(parsed.excerpt ?? ''),
        content: String(parsed.content_markdown ?? completion.content),
        seo_title: String(parsed.seo_title ?? title),
        seo_description: String(parsed.seo_description ?? ''),
        seo_keywords: Array.isArray(parsed.seo_keywords)
          ? parsed.seo_keywords.map(String)
          : [],
        city,
        sector: sector ?? undefined,
        // El cron deja draft; solo una ejecución manual explícita publica.
        status: publishImmediately ? 'published' : 'draft',
      });

      if (briefId) {
        await completeContentBrief(briefId, 'done');
      }

      sendAgentMessage({
        from: 'blog-writer',
        to: 'broadcast',
        topic: 'blog.created',
        body: `${publishImmediately ? 'Blog publicado' : 'Blog draft para revisión'}: ${title}`,
        payload: {
          slug,
          city,
          problem,
          trend,
          briefId,
          status: publishImmediately ? 'published' : 'draft',
        },
      });

      sendAgentMessage({
        from: 'blog-writer',
        to: 'social-creator',
        topic: 'blog.ready_for_social',
        body: `Puedes adaptar a IG/FB: ${title}`,
        payload: { slug, title, city },
      });

      const result: AgentResult = {
        status: 'ok',
        reason: `Blog ${publishImmediately ? 'publicado' : 'draft'}: ${slug}`,
        details: {
          slug,
          title,
          city,
          problem,
          trend,
          briefId,
          status: publishImmediately ? 'published' : 'draft',
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
      if (briefId) {
        await completeContentBrief(briefId, 'pending').catch(() => undefined);
      }
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', reason: message };
    }
  },
};
