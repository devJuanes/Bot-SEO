import { env } from '../config/env.js';
import { tryLoadCurrentProjectConfig } from '../tenancy/project-config.js';
// Re-export de la firma HMAC de Meta (compartida con Facebook/Instagram webhooks)
export { verifyMetaWebhookSignature as verifyWebhookSignature } from '../utils/meta-signature.js';

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${path}`;
}

async function requireCredentials(): Promise<{
  token: string;
  phoneNumberId: string;
  businessAccountId?: string;
}> {
  const cfg = await tryLoadCurrentProjectConfig().catch(() => null);
  if (cfg) {
    const token = cfg.whatsapp.accessToken;
    const phoneNumberId = cfg.whatsapp.phoneNumberId;
    if (!token || !phoneNumberId) {
      throw new Error(
        'WhatsApp no configurado para este proyecto. Configúralo en Ajustes.',
      );
    }
    return {
      token,
      phoneNumberId,
      businessAccountId:
        cfg.whatsapp.businessAccountId ?? env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    };
  }

  const token = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp no configurado.');
  }
  return {
    token,
    phoneNumberId,
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  };
}

let cachedWabaId: { phoneNumberId: string; wabaId: string } | null = null;

interface DebugTokenScope {
  scope?: string;
  target_ids?: string[];
}

async function graphGet(
  path: string,
  token: string,
): Promise<{ ok: boolean; json: Record<string, unknown> | null }> {
  const response = await fetch(graphUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: response.ok, json };
}

/** Extrae WABA IDs de los permisos granulares del token (debug_token). */
async function discoverWabaFromDebugToken(token: string): Promise<string[]> {
  const appId = env.META_APP_ID?.trim();
  const appSecret = env.META_APP_SECRET?.trim();
  const inspectAccessToken =
    appId && appSecret ? `${appId}|${appSecret}` : token;

  const { ok, json } = await graphGet(
    `debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(inspectAccessToken)}`,
    inspectAccessToken,
  );
  if (!ok || !json) return [];

  const data = json.data as { granular_scopes?: DebugTokenScope[] } | undefined;
  const ids = new Set<string>();
  for (const entry of data?.granular_scopes ?? []) {
    if (!entry.scope?.toLowerCase().includes('whatsapp')) continue;
    for (const id of entry.target_ids ?? []) {
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

/** Recorre cuentas de negocio y devuelve WABAs cuyo phone_number_id coincide. */
async function discoverWabaByPhoneNumber(
  token: string,
  phoneNumberId: string,
): Promise<string | null> {
  const candidates = new Set<string>(await discoverWabaFromDebugToken(token));

  const { ok: bizOk, json: bizJson } = await graphGet('me/businesses?fields=id', token);
  if (bizOk && bizJson) {
    const businesses = (bizJson.data as Array<{ id?: string }> | undefined) ?? [];
    for (const biz of businesses) {
      if (!biz.id) continue;
      const { ok, json } = await graphGet(
        `${biz.id}/owned_whatsapp_business_accounts?fields=id`,
        token,
      );
      if (!ok || !json) continue;
      for (const waba of (json.data as Array<{ id?: string }> | undefined) ?? []) {
        if (waba.id) candidates.add(waba.id);
      }
    }
  }

  for (const wabaId of candidates) {
    const { ok, json } = await graphGet(
      `${wabaId}/phone_numbers?fields=id&limit=50`,
      token,
    );
    if (!ok || !json) continue;
    const phones = (json.data as Array<{ id?: string }> | undefined) ?? [];
    if (phones.some((p) => p.id === phoneNumberId)) return wabaId;
  }

  if (candidates.size === 1) return [...candidates][0]!;
  return null;
}

/** WABA ID — solo necesario para listar plantillas. */
async function resolveBusinessAccountId(): Promise<string> {
  const creds = await requireCredentials();
  if (creds.businessAccountId) return creds.businessAccountId;

  if (cachedWabaId?.phoneNumberId === creds.phoneNumberId) {
    return cachedWabaId.wabaId;
  }

  const discovered = await discoverWabaByPhoneNumber(creds.token, creds.phoneNumberId);
  if (discovered) {
    cachedWabaId = { phoneNumberId: creds.phoneNumberId, wabaId: discovered };
    return discovered;
  }

  throw new Error(
    'No se pudo detectar el Business Account ID. Añádelo en Ajustes → WhatsApp o en WHATSAPP_BUSINESS_ACCOUNT_ID del .env.',
  );
}

async function callGraphApi(
  path: string,
  body?: Record<string, unknown>,
  method: 'GET' | 'POST' = 'POST',
): Promise<unknown> {
  const { token } = await requireCredentials();
  const response = await fetch(graphUrl(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } } | null)?.error?.message ??
      response.statusText;
    const hint =
      response.status === 401
        ? ' — Regenera whatsapp_access_token (System User permanente).'
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
  const { phoneNumberId } = await requireCredentials();
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
  const { phoneNumberId } = await requireCredentials();

  const components =
    bodyParams.length > 0
      ? [
          {
            type: 'body',
            parameters: bodyParams.map(
              (text): TemplateParam => ({ type: 'text', text }),
            ),
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

export async function listMessageTemplates(): Promise<
  Array<{ name: string; language: string; status: string; category?: string }>
> {
  const businessAccountId = await resolveBusinessAccountId();
  const payload = (await callGraphApi(
    `${businessAccountId}/message_templates?fields=name,status,language,category&limit=100`,
    undefined,
    'GET',
  )) as {
    data?: Array<{ name: string; language: string; status: string; category?: string }>;
  };
  return payload.data ?? [];
}

export async function markMessageAsRead(waMessageId: string): Promise<void> {
  const { phoneNumberId } = await requireCredentials();
  await callGraphApi(`${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: waMessageId,
  }).catch(() => undefined);
}

export async function isWhatsAppConfigured(): Promise<boolean> {
  const cfg = await tryLoadCurrentProjectConfig().catch(() => null);
  if (cfg) return cfg.whatsapp.configured;
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}
