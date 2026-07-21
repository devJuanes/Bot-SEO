import { parseJsonResponse } from './client';

export interface ContactPayload {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message: string;
  sourcePage?: string;
}

export async function submitContact(payload: ContactPayload): Promise<{ ok: boolean; id: string }> {
  let res: Response;
  try {
    res = await fetch('/api/public/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }

  const data = await parseJsonResponse<{ ok?: boolean; id?: string; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo enviar el mensaje');
  }
  return { ok: true, id: data.id ?? '' };
}
