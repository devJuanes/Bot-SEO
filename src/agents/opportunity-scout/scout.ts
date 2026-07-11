import type { Page } from 'playwright';
import { launchBrowser } from '../../browser/playwright.js';

export interface ScoutHit {
  externalId: string;
  source: string;
  opportunityType: 'job' | 'gov' | 'forum' | 'reddit';
  title: string;
  companyName?: string;
  description?: string;
  city?: string;
  country?: string;
  sourceUrl: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dismissConsent(page: Page): Promise<void> {
  const btn = page.locator('button:has-text("Aceptar todo"), button:has-text("Accept all")').first();
  if (await btn.isVisible({ timeout: 1200 }).catch(() => false)) {
    await btn.click().catch(() => undefined);
    await sleep(500);
  }
}

const QUERIES: Array<{
  q: string;
  source: string;
  opportunityType: ScoutHit['opportunityType'];
  city?: string;
}> = [
  {
    q: 'site:computrabajo.com.co desarrollador OR "ingeniero de software" OR fullstack Colombia',
    source: 'computrabajo',
    opportunityType: 'job',
    city: 'Colombia',
  },
  {
    q: 'site:elempleo.com "desarrollador" OR "automatización" OR "aplicación web" Cali OR Bogotá',
    source: 'elempleo',
    opportunityType: 'job',
    city: 'Colombia',
  },
  {
    q: '"alcaldía" (software OR "página web" OR aplicativo OR "sistema de información") Colombia licitación OR convocatoria',
    source: 'gov_search',
    opportunityType: 'gov',
    city: 'Colombia',
  },
  {
    q: 'site:secop.gov.co software OR aplicativo OR "desarrollo de software"',
    source: 'secop',
    opportunityType: 'gov',
    city: 'Colombia',
  },
  {
    q: 'site:reddit.com/r/Colombia "necesito una app" OR "quién me desarrolla" OR "página web para mi negocio"',
    source: 'reddit',
    opportunityType: 'reddit',
    city: 'Colombia',
  },
  {
    q: '"necesito un programador" OR "busco desarrollo de software" OR "quiero una aplicación" foro Colombia',
    source: 'forums_web',
    opportunityType: 'forum',
    city: 'Colombia',
  },
];

async function scrapeGoogleQuery(
  page: Page,
  query: string,
  meta: { source: string; opportunityType: ScoutHit['opportunityType']; city?: string },
  max = 6,
): Promise<ScoutHit[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=es&num=10`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await dismissConsent(page);
  await sleep(1200);

  const results = page.locator('#search a h3');
  const count = await results.count();
  const hits: ScoutHit[] = [];

  for (let i = 0; i < Math.min(count, max); i += 1) {
    const titleNode = results.nth(i);
    const title = (await titleNode.textContent().catch(() => null))?.trim();
    if (!title) continue;

    const link = titleNode.locator('xpath=ancestor::a[1]');
    const href = await link.getAttribute('href').catch(() => null);
    if (!href || !href.startsWith('http')) continue;

    let snippet =
      (await titleNode
        .locator('xpath=ancestor::div[contains(@class,"g")][1]//div[@data-sncf or contains(@class,"VwiC3b")]')
        .first()
        .textContent()
        .catch(() => null))?.trim() ?? '';

    const externalId = `${meta.source}:${Buffer.from(href).toString('base64url').slice(0, 48)}`;

    hits.push({
      externalId,
      source: meta.source,
      opportunityType: meta.opportunityType,
      title,
      description: snippet || title,
      city: meta.city,
      country: 'CO',
      sourceUrl: href,
      companyName: title.split(/[-|–]/)[0]?.trim(),
    });
  }

  return hits;
}

export async function scoutOpportunitySources(options?: {
  headless?: boolean;
  maxPerQuery?: number;
}): Promise<ScoutHit[]> {
  const session = await launchBrowser({ headless: options?.headless });
  const all: ScoutHit[] = [];

  try {
    for (const query of QUERIES) {
      try {
        const hits = await scrapeGoogleQuery(
          session.page,
          query.q,
          query,
          options?.maxPerQuery ?? 5,
        );
        all.push(...hits);
      } catch {
        // continue other queries
      }
      await sleep(900);
    }
  } finally {
    await session.close();
  }

  // de-dupe by URL in-memory
  const seen = new Set<string>();
  return all.filter((hit) => {
    if (seen.has(hit.sourceUrl)) return false;
    seen.add(hit.sourceUrl);
    return true;
  });
}
