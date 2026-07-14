import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { verifyMetaWebhookSignature } from '../utils/meta-signature.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';

/**
 * Webhook de Facebook Pages + Messenger.
 *
 * URL: GET/POST /webhooks/facebook
 *
 * Suscribirse en developers.facebook.com > App > Webhooks > Page y elegir
 * los eventos: feed, comments, reactions, leadgen, messages.
 *
 * Para dev local, exponer con ngrok:
 *   ngrok http 4100
 *   → https://xxxx.ngrok-free.app/webhooks/facebook
 *
 * Configurar en Meta:
 *   - Callback URL: la URL pública anterior
 *   - Verify Token: el valor de FB_WEBHOOK_VERIFY_TOKEN en tu .env
 *
 * Documentación: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */

interface FacebookWebhookChange {
  field?: string;
  value?: Record<string, unknown>;
}

interface FacebookWebhookEntry {
  id?: string;
  time?: number;
  changes?: FacebookWebhookChange[];
  /** Mensajes de Messenger cuando el webhook está suscrito a 'messages'. */
  messaging?: Array<Record<string, unknown>>;
}

interface FacebookWebhookBody {
  object?: string; // 'page' | 'user' | 'group' | etc.
  entry?: FacebookWebhookEntry[];
}

interface CommentChange {
  post_id?: string;
  comment_id?: string;
  from?: { id?: string; name?: string };
  message?: string;
  created_time?: number;
  parent_id?: string;
}

export async function facebookWebhookRoutes(app: FastifyInstance): Promise<void> {
  // ──── GET: handshake que Meta hace UNA sola vez cuando configuras la URL ────
  app.get<{
    Querystring: {
      'hub.mode'?: string;
      'hub.verify_token'?: string;
      'hub.challenge'?: string;
    };
  }>('/webhooks/facebook', async (request, reply) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } =
      request.query;

    if (mode === 'subscribe' && token === env.FB_WEBHOOK_VERIFY_TOKEN && challenge) {
      pushLog({
        level: 'success',
        agentId: 'facebook-publisher',
        message: `Webhook FB verificado por Meta · page=${String(challenge).slice(0, 8)}…`,
      });
      return reply.code(200).send(challenge);
    }

    pushLog({
      level: 'warn',
      agentId: 'facebook-publisher',
      message: 'Webhook FB verify falló (token o mode inválido)',
      details: {
        mode: mode ?? '?',
        tokenMatch: token === env.FB_WEBHOOK_VERIFY_TOKEN,
      },
    });
    return reply.code(403).send('Forbidden');
  });

  // ──── POST: eventos que Meta nos envía ────
  // IMPORTANT: ACK rápido (200 OK) ANTES de procesar — Meta reintenta agresivamente.
  app.post('/webhooks/facebook', async (request, reply) => {
    reply.code(200).send({ received: true });

    try {
      const raw = request.rawBody ?? '';
      const signature = request.headers['x-hub-signature-256'];

      if (!verifyMetaWebhookSignature(raw, signature)) {
        pushLog({
          level: 'error',
          agentId: 'facebook-publisher',
          message: 'Firma de webhook FB inválida — request ignorado',
          details: {
            hasSecret: Boolean(env.META_APP_SECRET),
            hasSignature: Boolean(signature),
          },
        });
        return;
      }

      const body = request.body as FacebookWebhookBody;
      if (!body?.entry?.length) return;

      for (const entry of body.entry) {
        const pageId = entry.id ?? '?';

        // ──── Cambios de Page (feed, comments, reactions, leadgen, etc.) ────
        for (const change of entry.changes ?? []) {
          const field = change.field ?? 'unknown';
          const value = (change.value ?? {}) as Record<string, unknown>;

          pushLog({
            level: 'info',
            agentId: 'facebook-publisher',
            message: `Webhook FB [${field}] page=${pageId.slice(0, 10)}…`,
            details: {
              field,
              page: pageId,
              value,
            },
          });

          // Procesado específico por field — hoy solo log + bus; mañana puede
          // convertirse en handlers de agente (responder comentarios, nutrir leads).
          if (field === 'comments' && value.item === 'comment' && value.verb === 'add') {
            const c = value as unknown as CommentChange;
            sendAgentMessage({
              from: 'facebook-publisher',
              to: 'broadcast',
              topic: 'facebook.comment',
              body: `Comentario de ${c.from?.name ?? 'alguien'} en post ${c.post_id ?? '?'}`,
              payload: {
                pageId,
                postId: c.post_id,
                commentId: c.comment_id,
                from: c.from,
                message: c.message,
                parentId: c.parent_id,
              },
            });
          }

          if (field === 'leadgen') {
            sendAgentMessage({
              from: 'facebook-publisher',
              to: 'opportunity-scout',
              topic: 'fb.lead',
              body: `Lead nuevo desde Facebook Lead Ad (page=${pageId.slice(0, 10)})`,
              payload: { pageId, value },
            });
          }
        }

        // ──── Mensajes de Messenger ────
        const messaging = entry.messaging ?? [];
        if (messaging.length > 0) {
          pushLog({
            level: 'info',
            agentId: 'facebook-publisher',
            message: `Webhook FB Messenger: ${messaging.length} mensajes`,
            details: { count: messaging.length, sample: messaging[0] },
          });
          sendAgentMessage({
            from: 'facebook-publisher',
            to: 'broadcast',
            topic: 'facebook.messenger',
            body: `${messaging.length} mensajes de Messenger`,
            payload: { pageId, messaging },
          });
        }
      }
    } catch (err) {
      request.log.error({ err }, 'Error procesando webhook FB');
    }
  });
}
