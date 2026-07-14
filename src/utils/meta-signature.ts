import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Verifica la firma X-Hub-Signature-256 que Meta envía en TODOS sus webhooks
 * (WhatsApp, Facebook Pages, Instagram, Messenger). Usa HMAC-SHA256 con el
 * App Secret de la app en developers.facebook.com.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 *
 * Modo dev: si META_APP_SECRET no está configurado, devuelve true (allow all).
 * En PRODUCCIÓN es obligatorio setearlo y verificarlo de verdad.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader?: string | string[] | undefined,
): boolean {
  if (!env.META_APP_SECRET) return true; // dev mode sin secret configurado

  const header = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;
  if (!header?.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');
  const provided = header.slice('sha256='.length);

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
