import {
  buildKnowledgeContext,
  gatherMarketSignals,
} from '../db/growth.js';
import {
  createForumPost,
  createForumThread,
  findThreadsNeedingAgentReply,
} from '../db/forum.js';
import { logAgentRun } from '../db/leads.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import { getMatuByteSummary } from '../knowledge/matubyte.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';
import type { Agent, AgentContext, AgentResult } from './types.js';

const AGENT_AUTHOR_NAME = 'MatuBot · Equipo MatuByte';

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { content: text };
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return { content: text };
  }
}

export const communityAgentAgent: Agent = {
  id: 'community-agent',
  name: 'Agente Comunidad',
  description:
    'Participa en el foro público de matubyte.com/foro: responde temas abiertos o inicia nuevos con tendencias/problemas reales.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();
    const brand = getMatuByteSummary();

    if (!(await isLlmConfigured())) {
      return {
        status: 'error',
        reason: 'LLM no configurado para este proyecto',
      };
    }

    try {
      const knowledge = await buildKnowledgeContext();
      const candidates = await findThreadsNeedingAgentReply(10);

      if (candidates.length > 0) {
        const { thread, posts } = candidates[0]!;

        pushLog({
          level: 'info',
          agentId: this.id,
          message: `Respondiendo tema · ${thread.title}`,
        });

        const history = posts
          .slice(-6)
          .map((p) => `${p.author_name} (${p.author_type}): ${p.content}`)
          .join('\n');

        const completion = await chatCompletion({
          temperature: 0.7,
          maxTokens: 700,
          messages: [
            {
              role: 'system',
              content: `Eres ${AGENT_AUTHOR_NAME}, participante técnico de ${brand.company} (${brand.hq}) en el foro público de matubyte.com.
Respondes de forma humana, útil, sin spam. Si aplica, sugieres suavemente un producto/servicio MatuByte.
Devuelve SOLO el texto de la respuesta (sin JSON, sin markdown, texto plano, máx 5 párrafos cortos).`,
            },
            {
              role: 'user',
              content: `Tema: ${thread.title}
Categoría: ${thread.category}

Conversación:
${history}

Knowledge MatuByte:
${knowledge.slice(0, 4000)}

Escribe la siguiente respuesta del hilo.`,
            },
          ],
        });

        await createForumPost({
          threadId: thread.id,
          content: completion.content.trim(),
          authorType: 'agent',
          authorName: AGENT_AUTHOR_NAME,
          agentId: this.id,
        });

        sendAgentMessage({
          from: 'community-agent',
          to: 'broadcast',
          topic: 'forum.replied',
          body: `Respondí en el foro: ${thread.title}`,
          payload: { threadId: thread.id, slug: thread.slug },
        });

        const result: AgentResult = {
          status: 'ok',
          reason: `Respuesta publicada en "${thread.title}"`,
          details: { threadId: thread.id, slug: thread.slug, mode: 'reply' },
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
      }

      // No open thread needs a reply → start a new one from market signals.
      pushLog({
        level: 'info',
        agentId: this.id,
        message: 'Sin temas pendientes · iniciando nuevo hilo',
      });

      const signals = await gatherMarketSignals();
      const sector = signals.sectors[0] ?? 'negocios locales';
      const city = signals.cities[0] ?? 'Cali';

      const completion = await chatCompletion({
        temperature: 0.85,
        maxTokens: 700,
        messages: [
          {
            role: 'system',
            content: `Eres ${AGENT_AUTHOR_NAME} de ${brand.company}. Inicias temas de discusión genuinos en el foro comunitario de matubyte.com sobre software, digitalización de negocios y tecnología. Devuelve JSON.`,
          },
          {
            role: 'user',
            content: `Sector detectado: ${sector}
Ciudad: ${city}

Knowledge:
${knowledge.slice(0, 3000)}

Genera un tema de foro nuevo, JSON:
{
  "title": "título corto y directo",
  "category": "una palabra: software | web | automatizacion | seo | negocios",
  "content": "mensaje de apertura, 2-4 párrafos, invita a comentar, sin spam"
}`,
          },
        ],
      });

      const parsed = extractJson(completion.content);
      const title = String(parsed.title ?? `Digitalización para ${sector} en ${city}`);
      const content = String(parsed.content ?? completion.content);

      const thread = await createForumThread({
        title,
        content,
        category: String(parsed.category ?? 'negocios'),
        createdBy: this.id,
        authorType: 'agent',
        authorName: AGENT_AUTHOR_NAME,
        agentId: this.id,
      });

      sendAgentMessage({
        from: 'community-agent',
        to: 'broadcast',
        topic: 'forum.thread_created',
        body: `Nuevo tema en el foro: ${title}`,
        payload: { threadId: thread.id, slug: thread.slug },
      });

      const result: AgentResult = {
        status: 'ok',
        reason: `Nuevo tema: ${title}`,
        details: { threadId: thread.id, slug: thread.slug, mode: 'new_thread' },
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
