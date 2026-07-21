import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { verifyWebhookSignature } from '../whatsapp/client.js';
import { handleIncomingWhatsAppMessage } from '../whatsapp/bot.js';
import { downloadWhatsAppMedia, mediaPlaceholderLabel } from '../whatsapp/media.js';
import { pushLog } from '../runtime/state.js';
import {
  findProjectBySecretValue,
  type ProjectRow,
} from '../tenancy/store.js';
import { runWithTenantAsync } from '../tenancy/context.js';

function projectTenant(project: ProjectRow) {
  return {
    organizationId: project.organization_id,
    projectId: project.id,
  };
}

interface WaMediaRef {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
  sha256?: string;
}

interface WhatsAppInboundMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: WaMediaRef;
  audio?: WaMediaRef;
  video?: WaMediaRef;
  document?: WaMediaRef;
  sticker?: WaMediaRef;
}

interface WhatsAppWebhookValue {
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: WhatsAppInboundMessage[];
  metadata?: { display_phone_number?: string; phone_number_id?: string };
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

function getMediaPayload(
  message: WhatsAppInboundMessage,
): { type: string; media: WaMediaRef } | null {
  const type = message.type;
  if (type === 'image' && message.image?.id) return { type, media: message.image };
  if (type === 'audio' && message.audio?.id) return { type, media: message.audio };
  if (type === 'video' && message.video?.id) return { type, media: message.video };
  if (type === 'document' && message.document?.id) return { type, media: message.document };
  if (type === 'sticker' && message.sticker?.id) return { type, media: message.sticker };
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

        const phoneNumberId = value.metadata?.phone_number_id;
        let tenantCtx: ReturnType<typeof projectTenant> | null = null;

        if (phoneNumberId) {
          const p = await findProjectBySecretValue(
            'whatsapp_phone_number_id',
            phoneNumberId,
          );
          if (p) tenantCtx = projectTenant(p);
        }

        if (!tenantCtx && env.WHATSAPP_PHONE_NUMBER_ID) {
          const p = await findProjectBySecretValue(
            'whatsapp_phone_number_id',
            env.WHATSAPP_PHONE_NUMBER_ID,
          );
          if (p) tenantCtx = projectTenant(p);
        }

        // Credenciales solo en .env: vincular al proyecto que tenga el mismo access token guardado.
        if (
          !tenantCtx &&
          phoneNumberId &&
          env.WHATSAPP_PHONE_NUMBER_ID &&
          phoneNumberId === env.WHATSAPP_PHONE_NUMBER_ID &&
          env.WHATSAPP_ACCESS_TOKEN
        ) {
          const p = await findProjectBySecretValue(
            'whatsapp_access_token',
            env.WHATSAPP_ACCESS_TOKEN,
          );
          if (p) tenantCtx = projectTenant(p);
        }

        const processMessages = async () => {
          const contact = value.contacts?.[0];

          for (const message of value.messages!) {
            if (!message.from) continue;

            const text = extractText(message);
            const mediaPayload = getMediaPayload(message);

            if (!text && !mediaPayload) continue;

            let content = text || '';
            let messageType = 'text';
            let metadata: Record<string, unknown> | undefined;

            if (mediaPayload) {
              messageType = mediaPayload.type;
              const caption = mediaPayload.media.caption?.trim() || '';
              try {
                const downloaded = await downloadWhatsAppMedia({
                  mediaId: mediaPayload.media.id!,
                  mimeType: mediaPayload.media.mime_type,
                  filename: mediaPayload.media.filename,
                  waMessageId: message.id,
                });
                content =
                  caption ||
                  mediaPlaceholderLabel(mediaPayload.type, downloaded.filename);
                metadata = {
                  mediaUrl: downloaded.relativeUrl,
                  mimeType: downloaded.mimeType,
                  filename: downloaded.filename,
                  mediaId: mediaPayload.media.id,
                };
                pushLog({
                  level: 'info',
                  agentId: 'whatsapp-bot',
                  message: `Media ${mediaPayload.type} guardado: ${downloaded.relativeUrl}`,
                });
              } catch (err) {
                content =
                  caption ||
                  mediaPlaceholderLabel(
                    mediaPayload.type,
                    mediaPayload.media.filename,
                  );
                metadata = {
                  mediaId: mediaPayload.media.id,
                  mimeType: mediaPayload.media.mime_type ?? null,
                  downloadError: err instanceof Error ? err.message : String(err),
                };
                pushLog({
                  level: 'error',
                  agentId: 'whatsapp-bot',
                  message: `No se pudo descargar media: ${err instanceof Error ? err.message : String(err)}`,
                });
              }
            }

            await handleIncomingWhatsAppMessage({
              waId: message.from,
              profileName: contact?.profile?.name ?? null,
              text: content,
              waMessageId: message.id ?? null,
              messageType,
              metadata,
            });
          }
        };

        if (tenantCtx) {
          await runWithTenantAsync(tenantCtx, processMessages);
        } else {
          pushLog({
            level: 'warn',
            agentId: 'whatsapp-bot',
            message:
              'Webhook WA sin proyecto resuelto (configura secret whatsapp_phone_number_id)',
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
