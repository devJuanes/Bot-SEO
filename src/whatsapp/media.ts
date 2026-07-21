import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WA_MEDIA_DIR = join(__dirname, '..', '..', 'public', 'uploads', 'whatsapp');

const MIME_EXT: Record<string, string> = {
  'audio/ogg': '.ogg',
  'audio/opus': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/amr': '.amr',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
};

function requireToken(): string {
  if (!env.WHATSAPP_ACCESS_TOKEN) {
    throw new Error('WHATSAPP_ACCESS_TOKEN no configurado');
  }
  return env.WHATSAPP_ACCESS_TOKEN;
}

function pickExt(mimeType: string | undefined, filename?: string | null): string {
  if (filename) {
    const fromName = extname(filename).toLowerCase();
    if (fromName) return fromName;
  }
  if (mimeType && MIME_EXT[mimeType]) return MIME_EXT[mimeType];
  if (mimeType?.startsWith('audio/')) return '.ogg';
  if (mimeType?.startsWith('image/')) return '.jpg';
  if (mimeType?.startsWith('video/')) return '.mp4';
  return '.bin';
}

/**
 * Descarga media de Meta Cloud API y la guarda en public/uploads/whatsapp.
 * Flujo: GET /{mediaId} → url temporal → GET binario con Bearer.
 */
export async function downloadWhatsAppMedia(input: {
  mediaId: string;
  mimeType?: string | null;
  filename?: string | null;
  waMessageId?: string | null;
}): Promise<{ relativeUrl: string; mimeType: string; filename: string }> {
  const token = requireToken();
  const metaRes = await fetch(
    `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${input.mediaId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const meta = (await metaRes.json().catch(() => null)) as {
    url?: string;
    mime_type?: string;
    error?: { message?: string };
  } | null;

  if (!metaRes.ok || !meta?.url) {
    throw new Error(
      meta?.error?.message || `No se pudo resolver media ${input.mediaId} (${metaRes.status})`,
    );
  }

  const mimeType = input.mimeType || meta.mime_type || 'application/octet-stream';
  const ext = pickExt(mimeType, input.filename);
  const safeId = (input.waMessageId || input.mediaId).replace(/[^\w.-]/g, '_');
  const filename = `${safeId}${ext}`;

  await mkdir(WA_MEDIA_DIR, { recursive: true });
  const absPath = join(WA_MEDIA_DIR, filename);

  const binRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!binRes.ok || !binRes.body) {
    throw new Error(`Descarga de media falló (${binRes.status})`);
  }

  await pipeline(Readable.fromWeb(binRes.body as never), createWriteStream(absPath));

  return {
    relativeUrl: `/uploads/whatsapp/${filename}`,
    mimeType,
    filename: input.filename || filename,
  };
}

export function mediaPlaceholderLabel(messageType: string, filename?: string | null): string {
  switch (messageType) {
    case 'audio':
      return '🎤 Audio';
    case 'image':
      return '📷 Foto';
    case 'video':
      return '🎬 Video';
    case 'document':
      return filename ? `📄 ${filename}` : '📄 Documento';
    case 'sticker':
      return 'Sticker';
    default:
      return `[${messageType}]`;
  }
}
