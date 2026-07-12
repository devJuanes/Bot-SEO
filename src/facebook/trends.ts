import { withRetry } from '../utils/retry.js';

/**
 * Detector de tendencias para el agente facebook-publisher.
 *
 * Fuentes (todas sin API keys externas):
 *  - Reddit RSS público (subreddits: technology, startups, Colombia)
 *  - Google News RSS público (query "software Colombia OR transformación digital PYMES")
 *
 * El parser es regex nativo porque el repo no incluye fast-xml-parser
 * (no queremos meter una dep solo para esto). Reddit + Google News devuelven
 * RSS 2.0 estándar con bloques <item>...</item> muy estables.
 */

export type TrendSource = 'reddit' | 'news' | 'internal';

export interface TrendItem {
  source: TrendSource;
  title: string;
  url: string;
  score?: number;
  publishedAt?: string;
  /** Descripción corta en HTML plano, ya saneada, para inyectar al LLM. */
  summary?: string;
}

const DEFAULT_SUBREDDITS = ['technology', 'startups', 'Colombia'];
const DEFAULT_NEWS_QUERY =
  'software Colombia OR tecnología Cali OR transformación digital PYMES';
const REDDIT_UA = 'MatuByte-FB-Publisher/1.0 (+https://matubyte.com)';

async function fetchText(url: string): Promise<string> {
  return withRetry(
    async () => {
      const r = await fetch(url, {
        headers: { 'User-Agent': REDDIT_UA, Accept: 'application/rss+xml, application/xml, text/xml' },
      });
      if (!r.ok) {
        throw new Error(`RSS fetch ${r.status} ${url}`);
      }
      return r.text();
    },
    { attempts: 2, delayMs: 800, label: 'rss-fetch' },
  );
}

function extractItems(xml: string): string[] {
  return Array.from(xml.matchAll(/<item[\s\S]*?<\/item>/g)).map((m) => m[0]);
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pickTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeEntities(m[1].trim()) : null;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchReddit(): Promise<TrendItem[]> {
  const all: TrendItem[] = [];
  for (const sub of DEFAULT_SUBREDDITS) {
    const url = `https://www.reddit.com/r/${sub}/top.rss?t=day`;
    try {
      const xml = await fetchText(url);
      for (const item of extractItems(xml)) {
        const title = pickTag(item, 'title');
        const link = pickTag(item, 'link');
        const desc = pickTag(item, 'description');
        if (!title || !link) continue;
        all.push({
          source: 'reddit',
          title,
          url: link,
          summary: desc ? stripHtml(desc).slice(0, 280) : undefined,
        });
      }
    } catch {
      // Un subreddit caído no debe tumbar al agente; seguimos con los demás.
    }
  }
  return all.slice(0, 25);
}

async function fetchNews(): Promise<TrendItem[]> {
  const q = encodeURIComponent(DEFAULT_NEWS_QUERY);
  const url = `https://news.google.com/rss/search?q=${q}&hl=es-CO&gl=CO&ceid=CO:es`;
  const items: TrendItem[] = [];
  try {
    const xml = await fetchText(url);
    for (const block of extractItems(xml)) {
      const title = pickTag(block, 'title');
      const link = pickTag(block, 'link');
      const pubDate = pickTag(block, 'pubDate');
      const desc = pickTag(block, 'description');
      if (!title || !link) continue;
      items.push({
        source: 'news',
        title,
        url: link,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
        summary: desc ? stripHtml(desc).slice(0, 280) : undefined,
      });
    }
  } catch {
    // Igual que Reddit: si News falla, devolvemos array vacío.
  }
  return items.slice(0, 25);
}

export interface FetchOptions {
  /** Filtra a 1 sola fuente. Si no se pasa, devuelve mezcla de todas. */
  source?: TrendSource;
}

export async function fetchTrendingTopics(
  opts: FetchOptions = {},
): Promise<TrendItem[]> {
  let items: TrendItem[];
  if (opts.source === 'reddit') items = await fetchReddit();
  else if (opts.source === 'news') items = await fetchNews();
  else {
    const [reddit, news] = await Promise.all([fetchReddit(), fetchNews()]);
    // News primero porque está más alineado al mercado local de MatuByte.
    items = [...news, ...reddit];
  }

  // Dedupe por título normalizado.
  const seen = new Set<string>();
  const merged: TrendItem[] = [];
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/\W+/g, ' ').slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, 30);
}

/**
 * Texto consolidado de señales internas (leads + opportunities + sectores/ciudades).
 * Reutiliza gatherMarketSignals() de db/growth.ts para mantener una sola fuente de verdad.
 */
export async function fetchInternalSignals(): Promise<string> {
  const { gatherMarketSignals } = await import('../db/growth.js');
  const sig = await gatherMarketSignals();
  return [
    'LEADS RECIENTES (muchos sin web = oportunidad):',
    sig.leadsSummary || '(sin leads)',
    '',
    'OPORTUNIDADES DE MERCADO (empleos/gov/foros):',
    sig.opportunitiesSummary || '(sin opps)',
    '',
    'SECTORES ACTIVOS:',
    sig.sectors.join(', ') || 'n/a',
    'CIUDADES ACTIVAS:',
    sig.cities.join(', ') || 'Cali',
  ].join('\n');
}
