import { env } from '../config/env.js';

export interface PayMatuPaymentLink {
  url: string;
  link_id: string;
  reference: string;
  amount: number;
  currency: string;
}

export interface PayMatuLinkStatus {
  status: string;
  reference: string;
  transaction_id?: string | null;
  link_id?: string | null;
}

const PAID_STATUSES = new Set(['PAID', 'APPROVED', 'SALE_APPROVED']);

export function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.has(status.toUpperCase());
}

function paymatuConfig() {
  return {
    url: env.PAYMATUBYTE_URL.replace(/\/$/, ''),
    apiKey: (env.PAYMATUBYTE_API_KEY ?? '').trim(),
  };
}

export function isPayMatuConfigured(): boolean {
  const { apiKey, url } = paymatuConfig();
  return Boolean(apiKey && url);
}

async function paymatuFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { url: base, apiKey } = paymatuConfig();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  const body = (await res.json().catch(() => ({}))) as {
    status?: string;
    data?: T;
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    const detail = body.message ?? body.error ?? `PayMatuByte ${res.status}`;
    throw new Error(detail);
  }

  if (body.status === 'success' && body.data != null) {
    return body.data as T;
  }

  return body as T;
}

export async function createPaymentLink(params: {
  productId: string;
  reference: string;
  description?: string;
  returnUrl?: string;
}): Promise<PayMatuPaymentLink> {
  return paymatuFetch<PayMatuPaymentLink>('/v1/payment', {
    method: 'POST',
    body: JSON.stringify({
      productId: params.productId,
      reference: params.reference,
      description: params.description,
      returnUrl: params.returnUrl,
    }),
  });
}

export async function getPaymentStatus(referenceOrLinkId: string): Promise<PayMatuLinkStatus> {
  const encoded = encodeURIComponent(referenceOrLinkId);
  return paymatuFetch<PayMatuLinkStatus>(`/v1/payment/link/${encoded}`);
}
