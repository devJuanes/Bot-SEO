import { env } from '../config/env.js';
// Re-export de la firma HMAC de Meta (compartida con Facebook/Instagram webhooks)
export { verifyMetaWebhookSignature as verifyWebhookSignature } from '../utils/meta-signature.js';

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${path}`;
}

function requireCredentials(): { token: string; phoneNumberId: string } {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error(
      'WhatsApp no configurado. Define WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en .env.',
    );
  }
  return {
    token: env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
  };
}

async function callGraphApi(path: string, body: Record<string, unknown>): Promise<unknown> {
  const { token } = requireCredentials();
  const response = await fetch(graphUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } } | null)?.error?.message ??
      response.statusText;
    const hint =
      response.status === 401
        ? ' — Regenera WHATSAPP_ACCESS_TOKEN (System User permanente) y reinicia el bot. GET /api/whatsapp/diagnostics'
        : '';
    throw new Error(`WhatsApp API error (${response.status}): ${message}${hint}`);
  }
  return payload;
}

export interface SendMessageResult {
  waMessageId: string | null;
  raw: unknown;
}

export async function sendTextMessage(to: string, body: string): Promise<SendMessageResult> {
  const { phoneNumberId } = requireCredentials();
  const payload = await callGraphApi(`${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body, preview_url: false },
  });

  const messages = (payload as { messages?: Array<{ id?: string }> } | null)?.messages;
  return { waMessageId: messages?.[0]?.id ?? null, raw: payload };
}

export type TemplateParam = { type: 'text'; text: string };

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode = 'es',
  bodyParams: string[] = [],
): Promise<SendMessageResult> {
  const { phoneNumberId } = requireCredentials();

  const components =
    bodyParams.length > 0
      ? [
          {
            type: 'body',
            parameters: bodyParams.map<TemplateParam>((text) => ({ type: 'text', text })),
          },
        ]
      : undefined;

  const payload = await callGraphApi(`${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });

  const messages = (payload as { messages?: Array<{ id?: string }> } | null)?.messages;
  return { waMessageId: messages?.[0]?.id ?? null, raw: payload };
}

export async function markMessageAsRead(waMessageId: string): Promise<void> {
  const { phoneNumberId } = requireCredentials();
  await callGraphApi(`${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: waMessageId,
  }).catch(() => undefined);
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Verifica la firma X-Hub-Signature-256 que Meta envía en cada webhook.
 * Implementación ahora vive en src/utils/meta-signature.ts (compartida con Facebook/Instagram).
 * Esta función se re-exporta por compatibilidad con código existente.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
