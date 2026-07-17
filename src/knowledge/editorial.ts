import {
  AUDIENCE_PILLARS,
  PILLAR_WEIGHTS,
  PRODUCT_CATALOG,
  type AudiencePillar,
  type CatalogEntry,
  getCatalogEntry,
} from './product-catalog.js';

export type { AudiencePillar, CatalogEntry };

/** Reglas anti-spam / value-first compartidas por agentes editoriales. */
export const EDITORIAL_RULES = `Reglas editoriales MatuByte (obligatorias):
- Valor primero: educa o aporta insight antes de cualquier mención de producto.
- Mayoría educativa: la mayoría de piezas deben enseñar (tips, guías, conceptos), no vender.
- Como máximo UN producto o CTA por pieza. Si el pilar es education/general/trends, el CTA puede omitirse.
- Veracidad: no inventes features, clientes ni precios. FymApp es aliado recomendado (DIAN/ERP), NO producto MatuByte.
- Audiencias a rotar: educación, público general, emprendedores, desarrolladores, tendencias, casos de uso, comercial.
- Tono humano, español colombiano, sin spam ni urgencia falsa.
- Diversifica: no repitas el mismo producto, pilar o ángulo reciente.`;

export function pickWeightedPillar(
  recent: AudiencePillar[] = [],
  rng: () => number = Math.random,
): AudiencePillar {
  const recentSet = new Set(recent.slice(0, 5));
  const pool: AudiencePillar[] = [];
  for (const pillar of AUDIENCE_PILLARS) {
    let weight = PILLAR_WEIGHTS[pillar];
    if (recentSet.has(pillar)) weight = Math.max(1, Math.floor(weight / 3));
    for (let i = 0; i < weight; i += 1) pool.push(pillar);
  }
  return pool[Math.floor(rng() * pool.length)] ?? 'education';
}

/**
 * Rotación de productos: evita slugs recientes; si el pilar es no-comercial
 * prioriza entradas educativas / de caso de uso.
 */
export function pickCatalogProduct(opts: {
  recentSlugs?: string[];
  pillar?: AudiencePillar;
  allowPartner?: boolean;
  preferOwned?: boolean;
  rng?: () => number;
}): CatalogEntry {
  const {
    recentSlugs = [],
    pillar,
    allowPartner = true,
    preferOwned = false,
    rng = Math.random,
  } = opts;

  const recent = new Set(recentSlugs.map((s) => s.toLowerCase()));
  let candidates = PRODUCT_CATALOG.filter((p) => {
    if (!allowPartner && p.ownership === 'partner') return false;
    if (preferOwned && p.ownership === 'partner') return false;
    return true;
  });

  const fresh = candidates.filter((p) => !recent.has(p.slug) && !recent.has(p.id));
  if (fresh.length) candidates = fresh;

  if (pillar && pillar !== 'commercial') {
    const fitted = candidates.filter((p) => p.audiences.includes(pillar));
    if (fitted.length) candidates = fitted;
  }

  // En pilares educativos, baja probabilidad de partner hard-sell
  if (pillar === 'education' || pillar === 'general') {
    const nonPartner = candidates.filter((p) => p.ownership !== 'partner');
    if (nonPartner.length) candidates = nonPartner;
  }

  return candidates[Math.floor(rng() * candidates.length)] ?? PRODUCT_CATALOG[0]!;
}

export function shouldIncludeProductCta(pillar: AudiencePillar, rng: () => number = Math.random): boolean {
  // Majority educational: only commercial / use_cases / entrepreneurs often get CTA
  if (pillar === 'commercial') return true;
  if (pillar === 'use_cases' || pillar === 'entrepreneurs') return rng() < 0.55;
  if (pillar === 'developers' || pillar === 'trends') return rng() < 0.35;
  // education / general: rare soft mention
  return rng() < 0.2;
}

export function resolveCatalogFocus(slug: string | undefined | null): CatalogEntry | null {
  if (!slug) return null;
  return getCatalogEntry(slug) ?? null;
}

/** Mezcla briefs planeados: mayoría educativos, ≤1 comercial en el lote. */
export function diversifyPillarBatch(count: number, recent: AudiencePillar[] = []): AudiencePillar[] {
  const out: AudiencePillar[] = [];
  let commercialUsed = 0;
  for (let i = 0; i < count; i += 1) {
    let pillar = pickWeightedPillar([...recent, ...out]);
    if (pillar === 'commercial' && commercialUsed >= 1) {
      pillar = pickWeightedPillar([...recent, ...out, 'commercial']);
      if (pillar === 'commercial') pillar = 'education';
    }
    if (pillar === 'commercial') commercialUsed += 1;
    out.push(pillar);
  }
  // Garantiza ≥50% education-ish (education + general)
  let eduish = out.filter((p) => p === 'education' || p === 'general').length;
  const minimumEducational = Math.ceil(count / 2);
  if (eduish < minimumEducational) {
    for (let i = 0; i < out.length && eduish < minimumEducational; i += 1) {
      if (out[i] !== 'education' && out[i] !== 'general') {
        out[i] = 'education';
        eduish += 1;
      }
    }
  }
  return out;
}

export function pillarLabel(pillar: AudiencePillar): string {
  const labels: Record<AudiencePillar, string> = {
    education: 'educación / tips útiles',
    general: 'público general',
    entrepreneurs: 'emprendedores / negocios',
    developers: 'desarrolladores',
    trends: 'tendencias tech',
    use_cases: 'casos de uso',
    commercial: 'comercial / producto (máx 1 CTA)',
  };
  return labels[pillar];
}
