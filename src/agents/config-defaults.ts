import type { BrandProfile } from '../services/brand-setup.js';
import { HUNT_SECTORS } from '../knowledge/matubyte.js';
import { getProjectSetting } from '../tenancy/store.js';
import { nextHuntTarget } from '../runtime/hunt-rotation.js';

export interface LeadHunterConfig {
  sectors: string[];
  useRotation: boolean;
}

const LEAD_HUNTER_DEFAULTS: LeadHunterConfig = {
  sectors: [],
  useRotation: true,
};

function countryToCode(country: string): string {
  const c = country.trim().toLowerCase();
  if (c.includes('colomb')) return 'CO';
  if (c.includes('méxico') || c.includes('mexico')) return 'MX';
  if (c.includes('perú') || c.includes('peru')) return 'PE';
  if (c.includes('chile')) return 'CL';
  if (c.includes('argentin')) return 'AR';
  if (c.includes('ecuador')) return 'EC';
  if (c.includes('panam')) return 'PA';
  return 'CO';
}

function normalizeSectors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
}

export async function defaultAgentConfig(
  _projectId: string,
  agentId: string,
): Promise<Record<string, unknown>> {
  if (agentId !== 'lead-hunter') return {};
  return { ...LEAD_HUNTER_DEFAULTS };
}

export function mergeLeadHunterConfig(
  saved: Record<string, unknown> | null | undefined,
  defaults: LeadHunterConfig = LEAD_HUNTER_DEFAULTS,
): LeadHunterConfig {
  const s = saved ?? {};
  const sectors = normalizeSectors(s.sectors);
  return {
    sectors: sectors.length > 0 ? sectors : defaults.sectors,
    useRotation: s.useRotation !== false,
  };
}

export function resolveSectorPool(config: LeadHunterConfig): string[] {
  const picked = config.sectors.filter(Boolean);
  if (picked.length > 0) return picked;
  return HUNT_SECTORS;
}

export async function resolveLeadHunterRunParams(
  projectId: string | undefined,
  params: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | undefined> {
  if (params && Object.keys(params).length > 0) return params;
  if (!projectId) return params;

  const { getProjectAgent } = await import('../db/project-agents.js');
  const row = await getProjectAgent(projectId, 'lead-hunter');
  const cfg = mergeLeadHunterConfig(
    (row?.config as Record<string, unknown>) ?? {},
    LEAD_HUNTER_DEFAULTS,
  );

  const profile = await getProjectSetting<BrandProfile>(projectId, 'brand_profile');
  const country = profile?.country?.trim() || 'Colombia';
  const countryCode = countryToCode(country);
  const target = nextHuntTarget({
    countryCode,
    sectors: resolveSectorPool(cfg),
  });

  return {
    city: target.city,
    sector: target.sector,
    query: target.query,
    country: target.country,
    countryCode: target.countryCode,
  };
}
