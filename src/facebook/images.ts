/**
 * Búsqueda de fotos/videos en Pexels (opcional).
 * Key: https://www.pexels.com/api/
 */

export type PexelsPhoto = {
  url: string;
  alt: string;
  photographer?: string;
};

export type PexelsVideo = {
  url: string;
  alt: string;
  thumb?: string;
  duration?: number;
};

function isTruthy(value: string | undefined): boolean {
  return Boolean(value && value.trim() && !/replace_me|changeme|xxx|^tu_/i.test(value));
}

export function isPexelsConfigured(): boolean {
  return isTruthy(process.env.PEXELS_API_KEY);
}

export async function searchPexelsPhoto(
  query: string,
  seed = query,
): Promise<PexelsPhoto | null> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key || !query.trim()) return null;

  try {
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', query.slice(0, 80));
    url.searchParams.set('per_page', '8');
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('locale', 'es-ES');

    const res = await fetch(url.toString(), {
      headers: { Authorization: key },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: Array<{
        alt?: string;
        photographer?: string;
        src?: { large2x?: string; large?: string; original?: string };
      }>;
    };
    const photos = data.photos ?? [];
    if (!photos.length) return null;

    const photo = photos[hashSeed(seed) % photos.length]!;
    const src =
      photo.src?.large2x ?? photo.src?.large ?? photo.src?.original ?? null;
    if (!src) return null;
    return {
      url: src,
      alt: photo.alt || query,
      photographer: photo.photographer,
    };
  } catch {
    return null;
  }
}

/**
 * Video MP4 público corto (≤ ~45s, calidad media) para Facebook file_url.
 */
export async function searchPexelsVideo(
  query: string,
  seed = query,
): Promise<PexelsVideo | null> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key || !query.trim()) return null;

  try {
    const url = new URL('https://api.pexels.com/videos/search');
    url.searchParams.set('query', query.slice(0, 80));
    url.searchParams.set('per_page', '6');
    url.searchParams.set('orientation', 'landscape');

    const res = await fetch(url.toString(), {
      headers: { Authorization: key },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      videos?: Array<{
        id: number;
        duration?: number;
        image?: string;
        video_files?: Array<{
          id: number;
          quality?: string;
          file_type?: string;
          width?: number;
          height?: number;
          link?: string;
        }>;
      }>;
    };
    const videos = (data.videos ?? []).filter(
      (v) => (v.duration ?? 99) >= 5 && (v.duration ?? 0) <= 45,
    );
    if (!videos.length) return null;

    const video = videos[hashSeed(seed) % videos.length]!;
    const files = (video.video_files ?? []).filter(
      (f) =>
        f.file_type === 'video/mp4' &&
        f.link &&
        (f.width ?? 0) >= 640 &&
        (f.width ?? 9999) <= 1280,
    );
    const preferred =
      files.find((f) => f.quality === 'hd') ??
      files.find((f) => f.quality === 'sd') ??
      files[0] ??
      video.video_files?.find((f) => f.link && f.file_type === 'video/mp4');

    if (!preferred?.link) return null;
    return {
      url: preferred.link,
      alt: query,
      thumb: video.image,
      duration: video.duration,
    };
  } catch {
    return null;
  }
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function buildPexelsQuery(themes: string[], topic: string): string {
  const cleaned = [...themes, topic]
    .map((t) => t.replace(/[#_]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4);
  const map: Record<string, string> = {
    crm: 'crm dashboard laptop',
    clientes: 'customer relationship business',
    whatsapp: 'smartphone messaging business',
    automatizacion: 'office automation technology',
    'inteligencia artificial': 'artificial intelligence workspace',
    ia: 'ai technology office',
    software: 'software development coding',
    pyme: 'small business office laptop',
    pymes: 'small business team',
    'transformacion digital': 'digital transformation office',
    digitalizacion: 'digital business technology',
    web: 'website design laptop',
    seo: 'seo analytics computer',
    ventas: 'sales team meeting',
  };
  const translated = cleaned.map((c) => {
    const key = c
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return map[key] ?? c;
  });
  return (translated.join(' ') || 'business technology laptop').slice(0, 80);
}

export type MediaChoice = {
  mediaType: 'image' | 'video';
  url: string;
  thumbUrl?: string | null;
};

/**
 * Elige imagen o video según preferencia del LLM + disponibilidad Pexels.
 * Si pide video y no hay, cae a imagen.
 */
export async function resolveFacebookMedia(input: {
  prefer?: 'image' | 'video' | 'auto';
  themes: string[];
  topic: string;
  seed: string;
  fallbackImageUrl: string;
}): Promise<MediaChoice> {
  const prefer = input.prefer ?? 'auto';
  const q = buildPexelsQuery(input.themes, input.topic);
  const wantVideo =
    prefer === 'video' ||
    (prefer === 'auto' && shouldAutoPickVideo(input.topic, input.themes));

  if (wantVideo && isPexelsConfigured()) {
    const video = await searchPexelsVideo(q, input.seed).catch(() => null);
    if (video?.url) {
      return {
        mediaType: 'video',
        url: video.url,
        thumbUrl: video.thumb ?? null,
      };
    }
  }

  if (isPexelsConfigured()) {
    const photo = await searchPexelsPhoto(q, input.seed).catch(() => null);
    if (photo?.url) {
      return { mediaType: 'image', url: photo.url, thumbUrl: photo.url };
    }
  }

  return {
    mediaType: 'image',
    url: input.fallbackImageUrl,
    thumbUrl: input.fallbackImageUrl,
  };
}

function shouldAutoPickVideo(topic: string, themes: string[]): boolean {
  const hay = `${topic} ${themes.join(' ')}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  // ~30% de posts o temas muy "demo/movimiento"
  if (/(demo|tutorial|automat|ia |ai |robot|timelapse|proceso)/.test(hay)) {
    return true;
  }
  return hashSeed(topic) % 10 < 3;
}
