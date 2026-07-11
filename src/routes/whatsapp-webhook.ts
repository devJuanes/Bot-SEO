import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { verifyWebhookSignature } from '../whatsapp/client.js';
import { handleIncomingWhatsAppMessage } from '../whatsapp/bot.js';
import { pushLog } from '../runtime/state.js';

interface WhatsAppInboundMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
}

interface WhatsAppWebhookValue {
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: WhatsAppInboundMessage[];
}

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{ field?: string; value?: WhatsAppWebhookValue }>;
  }>;
}

function extractText(message: WhatsAppInboundMessage): string | null {
  if (message.text?.body) return message.text.body;
  if (message.button?.text) return message.button.text;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  return null;
}

export async function whatsappWebhookRoutes(app: FastifyInstance): Promise<void> {
  // Meta calls this once when you configure the webhook URL in the developer console.
  app.get<{
    Querystring: {
      'hub.mode'?: string;
      'hub.verify_token'?: string;
      'hub.challenge'?: string;
    };
  }>('/webhooks/whatsapp', async (request, reply) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } =
      request.query;

    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
      pushLog({ level: 'success', agentId: 'whatsapp-bot', message: 'Webhook verificado por Meta' });
      return reply.code(200).send(challenge);
    }

    pushLog({ level: 'warn', agentId: 'whatsapp-bot', message: 'Webhook verify falló (token no coincide)' });
    return reply.code(403).send('Forbidden');
  });

  app.post('/webhooks/whatsapp', async (request, reply) => {
    // Always ACK fast — Meta retries aggressively on non-200 responses.
    reply.code(200).send({ received: true });

    try {
      const signature = request.headers['x-hub-signature-256'] as string | undefined;
      if (!verifyWebhookSignature(request.rawBody ?? '', signature)) {
        pushLog({
          level: 'error',
          agentId: 'whatsapp-bot',
          message: 'Firma de webhook inválida — mensaje ignorado',
        });
        return;
      }

      const body = request.body as WhatsAppWebhookBody;
      const changes = body.entry?.flatMap((e) => e.changes ?? []) ?? [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value?.messages) continue;

        const contact = value.contacts?.[0];

        for (const message of value.messages) {
          const text = extractText(message);
          if (!message.from || !text) continue;

          await handleIncomingWhatsAppMessage({
            waId: message.from,
            profileName: contact?.profile?.name ?? null,
            text,
            waMessageId: message.id ?? null,
          });
        }
      }
    } catch (err) {
      request.log.error({ err }, 'Error processing WhatsApp webhook');
      pushLog({
        level: 'error',
        agentId: 'whatsapp-bot',
        message: `Webhook error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}
