import {
  getAppBySlug,
  listAppConnections,
  listContentScripts,
  listPendingBriefs,
  type AppConnection,
} from '../db/growth.js';
import {
  type AudiencePillar,
} from './editorial.js';
import {
  PRODUCT_CATALOG,
  getCatalogEntry,
  type CatalogEntry,
} from './product-catalog.js';

export interface ContentFocus {
  slug: string;
  name: string;
  description: string;
  url: string | null;
  features: string[];
  brandVoice: string | null;
  ownership: CatalogEntry['ownership'];
  partnerNote?: string;
  source: 'app_connection' | 'catalog';
  appId?: string;
  accessToken?: string | null;
}

function parseFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function appToFocus(app: AppConnection): ContentFocus {
  const catalog = getCatalogEntry(app.slug);
  return {
    slug: app.slug,
    name: app.name,
    description: app.description ?? catalog?.description ?? '',
    url: app.app_url ?? catalog?.url ?? null,
    features: parseFeatures(app.features).length
      ? parseFeatures(app.features)
      : (catalog?.features ?? []),
    brandVoice: app.brand_voice,
    ownership: catalog?.ownership ?? 'matubyte',
    partnerNote: catalog?.partnerNote,
    source: 'app_connection',
    appId: app.id,
    accessToken: app.access_token,
  };
}

function catalogToFocus(entry: CatalogEntry): ContentFocus {
  return {
    slug: entry.slug,
    name: entry.name,
    description: entry.description,
    url: entry.url ?? null,
    features: entry.features,
    brandVoice: 'técnico cercano, Cali',
    ownership: entry.ownership,
    partnerNote: entry.partnerNote,
    source: 'catalog',
  };
}

/** Slugs usados recientemente en scripts o briefs (metadata / título). */
export async function listRecentFocusSlugs(daysBack = 14): Promise<string[]> {
  const since = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const slugs = new Set<string>();

  const scripts = await listContentScripts(40).catch(() => []);
  for (const row of scripts) {
    const created = Date.parse(String(row.created_at ?? ''));
    if (Number.isFinite(created) && created < since) continue;
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const slug = meta.app_slug ?? meta.product_slug ?? meta.catalog_slug;
    if (typeof slug === 'string' && slug) slugs.add(slug.toLowerCase());
  }

  const briefs = await listPendingBriefs(30).catch(() => []);
  for (const brief of briefs) {
    const meta = (brief.metadata ?? {}) as Record<string, unknown>;
    const slug = meta.product_slug ?? meta.catalog_slug ?? meta.app_slug;
    if (typeof slug === 'string' && slug) slugs.add(slug.toLowerCase());
  }

  return [...slugs];
}

export async function listRecentPillars(daysBack = 14): Promise<AudiencePillar[]> {
  const pillars: AudiencePillar[] = [];
  const scripts = await listContentScripts(30).catch(() => []);
  const since = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  for (const row of scripts) {
    const created = Date.parse(String(row.created_at ?? ''));
    if (Number.isFinite(created) && created < since) continue;
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const pillar = meta.audience_pillar ?? meta.pillar;
    if (
      typeof pillar === 'string' &&
      [
        'education',
        'general',
        'entrepreneurs',
        'developers',
        'trends',
        'use_cases',
        'commercial',
      ].includes(pillar)
    ) {
      pillars.push(pillar as AudiencePillar);
    }
  }
  return pillars;
}

export async function listActiveAppConnections(): Promise<AppConnection[]> {
  const apps = await listAppConnections().catch(() => []);
  return apps.filter((a) => a.is_active !== false);
}

/**
 * Selección activa/reciente-aware: no usa siempre apps[0] (más nuevo).
 * Prefiere app_connections activos menos usados recientemente; si no hay, cae al catálogo.
 */
export async function pickContentFocus(opts: {
  appSlug?: string;
  pillar?: AudiencePillar;
  allowPartner?: boolean;
} = {}): Promise<ContentFocus | null> {
  if (opts.appSlug) {
    const app = await getAppBySlug(opts.appSlug).catch(() => null);
    if (app) return appToFocus(app);
    const catalog = getCatalogEntry(opts.appSlug);
    if (catalog) return catalogToFocus(catalog);
    return null;
  }

  const recent = await listRecentFocusSlugs(14).catch((): string[] => []);
  const active = await listActiveAppConnections();
  const bySlug = new Map<string, ContentFocus>();
  for (const app of active) bySlug.set(app.slug, appToFocus(app));
  for (const entry of PRODUCT_CATALOG) {
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, catalogToFocus(entry));
    }
  }

  let candidates = [...bySlug.values()].filter(
    (focus) => opts.allowPartner !== false || focus.ownership !== 'partner',
  );
  if (opts.pillar) {
    const fitted = candidates.filter((focus) =>
      getCatalogEntry(focus.slug)?.audiences.includes(opts.pillar!),
    );
    if (fitted.length) candidates = fitted;
  }

  const recentSet = new Set(recent.map((s) => s.toLowerCase()));
  const fresh = candidates.filter(
    (focus) => !recentSet.has(focus.slug.toLowerCase()),
  );
  if (fresh.length) candidates = fresh;
  candidates.sort((a, b) => a.slug.localeCompare(b.slug));

  const rotationSlot = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  return candidates[rotationSlot % candidates.length] ?? null;
}

export function focusPromptBlock(focus: ContentFocus): string {
  const ownership =
    focus.ownership === 'partner'
      ? 'ALIADO (no es producto MatuByte)'
      : focus.ownership === 'service'
        ? 'SERVICIO MatuByte'
        : 'PRODUCTO MatuByte';
  const note = focus.partnerNote ? `\nNota veraz: ${focus.partnerNote}` : '';
  return `Foco: ${focus.name} [${ownership}] (${focus.slug})
URL: ${focus.url ?? 'N/A'}
Descripción: ${focus.description}
Features: ${focus.features.join(', ') || 'n/a'}
Brand voice: ${focus.brandVoice ?? 'técnico cercano'}
Fuente: ${focus.source}${note}`;
}

export function listCatalogSlugs(): string[] {
  return PRODUCT_CATALOG.map((p) => p.slug);
}
