/**
 * Brand onboarding helpers: manual save + automatic scrape/extract.
 */
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import {
  getProject,
  getProjectSetting,
  setProjectSetting,
  updateProject,
} from '../tenancy/store.js';

export interface BrandProfile {
  brand_name: string;
  description: string;
  country: string;
  phone: string;
  website?: string;
  google_maps_url?: string;
  socials?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    tiktok?: string;
  };
  knowledge: string;
  source: 'manual' | 'auto';
  configured_at: string;
}

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; MatuByteGrowthBot/1.0; +https://matubyte.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} al obtener ${url}`);
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);
  } finally {
    clearTimeout(t);
  }
}

export async function isBrandConfigured(projectId: string): Promise<boolean> {
  const project = await getProject(projectId);
  if (project?.brand_configured) return true;
  const profile = await getProjectSetting<BrandProfile>(projectId, 'brand_profile');
  if (profile?.brand_name && profile?.knowledge) return true;
  const name = await getProjectSetting<string>(projectId, 'brand_name');
  const knowledge = await getProjectSetting<string>(projectId, 'brand_knowledge');
  return Boolean(name && knowledge);
}

export async function saveBrandManual(
  projectId: string,
  input: {
    brand_name: string;
    description: string;
    country?: string;
    phone?: string;
    website?: string;
    socials?: BrandProfile['socials'];
  },
): Promise<BrandProfile> {
  const knowledge = [
    `Marca: ${input.brand_name}`,
    input.description,
    input.country ? `País: ${input.country}` : '',
    input.phone ? `Teléfono: ${input.phone}` : '',
    input.website ? `Web: ${input.website}` : '',
    input.socials
      ? `Redes: ${Object.entries(input.socials)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const profile: BrandProfile = {
    brand_name: input.brand_name.trim(),
    description: input.description.trim(),
    country: (input.country || '').trim(),
    phone: (input.phone || '').trim(),
    website: input.website?.trim(),
    socials: input.socials,
    knowledge,
    source: 'manual',
    configured_at: new Date().toISOString(),
  };

  await setProjectSetting(projectId, 'brand_name', profile.brand_name);
  await setProjectSetting(projectId, 'brand_knowledge', knowledge);
  await setProjectSetting(projectId, 'brand_profile', profile);
  await updateProject(projectId, {
    brand_name: profile.brand_name,
    brand_configured: true,
  });
  return profile;
}

export async function saveBrandAuto(
  projectId: string,
  input: {
    websiteUrl: string;
    googleMapsUrl?: string;
    socials?: BrandProfile['socials'];
  },
): Promise<BrandProfile> {
  const websiteUrl = input.websiteUrl.trim();
  if (!/^https?:\/\//i.test(websiteUrl)) {
    throw new Error('La URL del sitio debe empezar con http:// o https://');
  }

  const siteText = await fetchText(websiteUrl);
  let mapsText = '';
  if (input.googleMapsUrl?.trim()) {
    try {
      mapsText = await fetchText(input.googleMapsUrl.trim());
    } catch {
      mapsText = '';
    }
  }

  let extracted: Record<string, unknown> = {};
  if (await isLlmConfigured()) {
    const completion = await chatCompletion({
      temperature: 0.3,
      maxTokens: 900,
      messages: [
        {
          role: 'system',
          content:
            'Extraes identidad de marca desde texto de un sitio web. Responde SOLO JSON válido con keys: brand_name, description, country, phone, knowledge (texto largo en español para agentes).',
        },
        {
          role: 'user',
          content: `URL: ${websiteUrl}
Maps URL: ${input.googleMapsUrl || 'n/a'}
Texto web:
${siteText.slice(0, 8000)}

Texto maps (opcional):
${mapsText.slice(0, 2000)}`,
        },
      ],
    });
    extracted = extractJson(completion.content);
  }

  const brand_name =
    String(extracted.brand_name || '').trim() ||
    new URL(websiteUrl).hostname.replace(/^www\./, '');
  const description =
    String(extracted.description || '').trim() ||
    `Negocio detectado en ${websiteUrl}`;
  const knowledge =
    String(extracted.knowledge || '').trim() ||
    `Sitio: ${websiteUrl}\nResumen: ${siteText.slice(0, 1500)}`;

  const profile: BrandProfile = {
    brand_name,
    description,
    country: String(extracted.country || '').trim(),
    phone: String(extracted.phone || '').trim(),
    website: websiteUrl,
    google_maps_url: input.googleMapsUrl?.trim(),
    socials: input.socials,
    knowledge,
    source: 'auto',
    configured_at: new Date().toISOString(),
  };

  await setProjectSetting(projectId, 'brand_name', profile.brand_name);
  await setProjectSetting(projectId, 'brand_knowledge', knowledge);
  await setProjectSetting(projectId, 'brand_profile', profile);
  await updateProject(projectId, {
    brand_name: profile.brand_name,
    brand_configured: true,
  });
  return profile;
}

/** Default multi-source hunt config (Maps live; others scaffolded). */
export const DEFAULT_HUNT_SOURCES = {
  google_maps: { enabled: true, status: 'live' as const },
  jobs: { enabled: false, status: 'scaffold' as const, note: 'Empleos / LinkedIn / portales — stub' },
  forums: { enabled: false, status: 'partial' as const, note: 'Usa opportunity-scout / infiltrator' },
  news: { enabled: false, status: 'scaffold' as const, note: 'Noticias y anuncios — stub' },
  announcements: { enabled: false, status: 'scaffold' as const, note: 'RFP / licitaciones — stub' },
};
