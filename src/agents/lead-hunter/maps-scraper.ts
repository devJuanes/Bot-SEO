import type { Page } from 'playwright';
import { launchBrowser } from '../../browser/playwright.js';

export interface MapsScrapeOptions {
  query: string;
  city: string;
  sector?: string;
  maxResults: number;
  headless?: boolean;
}

export interface MapsPlace {
  externalId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewsCount: number | null;
  mapsUrl: string;
  latitude: number | null;
  longitude: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractCoords(url: string): { latitude: number | null; longitude: number | null } {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return {
      latitude: Number(atMatch[1]),
      longitude: Number(atMatch[2]),
    };
  }

  const bangMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    return {
      latitude: Number(bangMatch[1]),
      longitude: Number(bangMatch[2]),
    };
  }

  return { latitude: null, longitude: null };
}

function extractExternalId(href: string, name: string): string {
  const placeIdMatch = href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (placeIdMatch?.[1]) return placeIdMatch[1];

  const chMatch = href.match(/place_id[=:]([A-Za-z0-9_-]+)/);
  if (chMatch?.[1]) return chMatch[1];

  const dataMatch = href.match(/\/maps\/place\/([^/]+)/);
  if (dataMatch?.[1]) {
    return decodeURIComponent(dataMatch[1]).slice(0, 200);
  }

  return `${name}`.toLowerCase().replace(/\s+/g, '-').slice(0, 180);
}

function parseRating(text: string | null): number | null {
  if (!text) return null;
  const match = text.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseReviews(text: string | null): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

async function dismissConsent(page: Page): Promise<void> {
  const candidates = [
    'button:has-text("Aceptar todo")',
    'button:has-text("Accept all")',
    'button:has-text("Rechazar todo")',
    'button:has-text("Reject all")',
    'form[action*="consent"] button',
  ];

  for (const selector of candidates) {
    const button = page.locator(selector).first();
    if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
      await button.click({ timeout: 3000 }).catch(() => undefined);
      await sleep(800);
      return;
    }
  }
}

async function collectResultHrefs(page: Page, maxResults: number): Promise<string[]> {
  const feed = page.locator('div[role="feed"]').first();
  await feed.waitFor({ state: 'visible', timeout: 30000 });

  const hrefs = new Set<string>();
  let stagnantRounds = 0;

  while (hrefs.size < maxResults && stagnantRounds < 4) {
    const before = hrefs.size;
    const links = page.locator('div[role="feed"] a[href*="/maps/place/"]');
    const count = await links.count();

    for (let i = 0; i < count; i += 1) {
      const href = await links.nth(i).getAttribute('href');
      if (!href) continue;
      const absolute = href.startsWith('http')
        ? href
        : `https://www.google.com${href}`;
      hrefs.add(absolute.split('&')[0] ?? absolute);
      if (hrefs.size >= maxResults) break;
    }

    if (hrefs.size === before) {
      stagnantRounds += 1;
    } else {
      stagnantRounds = 0;
    }

    await feed.evaluate((node) => {
      node.scrollBy(0, 900);
    });
    await sleep(700);
  }

  return [...hrefs].slice(0, maxResults);
}

async function readPlaceDetails(page: Page, mapsUrl: string): Promise<MapsPlace | null> {
  await page.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(800);

  const name =
    (await page.locator('h1').first().textContent({ timeout: 10000 }).catch(() => null))?.trim() ??
    null;

  if (!name || /resultados|results/i.test(name)) {
    return null;
  }

  const website =
    (await page
      .locator('a[data-item-id="authority"]')
      .first()
      .getAttribute('href')
      .catch(() => null)) ??
    (await page
      .locator('a[aria-label*="Sitio web"], a[aria-label*="Website"]')
      .first()
      .getAttribute('href')
      .catch(() => null));

  const phoneLabel =
    (await page
      .locator('button[data-item-id^="phone:"]')
      .first()
      .getAttribute('aria-label')
      .catch(() => null)) ??
    (await page
      .locator('button[aria-label*="Teléfono"], button[aria-label*="Phone"]')
      .first()
      .getAttribute('aria-label')
      .catch(() => null));

  const phone = phoneLabel
    ? phoneLabel.replace(/^(Teléfono|Phone):\s*/i, '').trim()
    : null;

  const address =
    (await page
      .locator('button[data-item-id="address"]')
      .first()
      .getAttribute('aria-label')
      .catch(() => null))?.replace(/^(Dirección|Address):\s*/i, '').trim() ??
    (await page
      .locator('button[aria-label*="Dirección"], button[aria-label*="Address"]')
      .first()
      .getAttribute('aria-label')
      .catch(() => null))?.replace(/^(Dirección|Address):\s*/i, '').trim() ??
    null;

  const ratingText =
    (await page
      .locator('div.F7nice span[aria-hidden="true"]')
      .first()
      .textContent()
      .catch(() => null)) ??
    (await page.locator('[aria-label*="estrellas"], [aria-label*="stars"]').first().getAttribute('aria-label').catch(() => null));

  const reviewsText =
    (await page.locator('div.F7nice span[aria-label*="reseña"], div.F7nice span[aria-label*="review"]').first().getAttribute('aria-label').catch(() => null));

  const currentUrl = page.url();
  const coords = extractCoords(currentUrl);

  return {
    externalId: extractExternalId(currentUrl, name),
    name,
    address,
    phone,
    website: website && !website.includes('google.com') ? website : null,
    rating: parseRating(ratingText),
    reviewsCount: parseReviews(reviewsText),
    mapsUrl: currentUrl,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

/**
 * Scrapes Google Maps search results and returns place details.
 * Callers decide business rules (e.g. needs_website).
 */
export async function scrapeGoogleMapsPlaces(
  options: MapsScrapeOptions,
): Promise<MapsPlace[]> {
  const searchQuery = options.sector
    ? `${options.sector} ${options.city}`
    : options.query;

  const session = await launchBrowser({ headless: options.headless });
  const places: MapsPlace[] = [];

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}?hl=es`;
    await session.page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissConsent(session.page);
    await sleep(2000);

    const hrefs = await collectResultHrefs(session.page, options.maxResults);

    for (const href of hrefs) {
      try {
        const place = await readPlaceDetails(session.page, href);
        if (place) places.push(place);
      } catch {
        // Skip flaky cards; continue the batch.
      }
      await sleep(400);
    }
  } finally {
    await session.close();
  }

  return places;
}
