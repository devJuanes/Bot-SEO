import { env } from '../config/env.js';
import { getTenant, requireTenant } from './context.js';
import {
  getProject,
  getProjectSecret,
  getProjectSetting,
  listProjectSettings,
  type ProjectRow,
} from './store.js';

export interface ProjectConfig {
  project: ProjectRow;
  brandName: string;
  brandKnowledge: string;
  huntLocations: unknown;
  ctaUrl?: string;
  llm: {
    provider: string;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    configured: boolean;
  };
  whatsapp: {
    enabled: boolean;
    configured: boolean;
    accessToken?: string;
    phoneNumberId?: string;
    businessAccountId?: string;
    ownerPhone?: string;
    verifyToken?: string;
    handoffKeywords: string;
  };
  facebook: {
    enabled: boolean;
    configured: boolean;
    dryRun: boolean;
    autoPublish: boolean;
    pageId?: string;
    pageAccessToken?: string;
  };
}

const cache = new Map<string, { at: number; config: ProjectConfig }>();
const CACHE_TTL_MS = 30_000;

function settingsMap(
  rows: Array<{ key: string; value: unknown }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export function invalidateProjectConfigCache(projectId?: string): void {
  if (!projectId) {
    cache.clear();
    return;
  }
  cache.delete(projectId);
}

export async function loadProjectConfig(
  projectId: string,
): Promise<ProjectConfig> {
  const hit = cache.get(projectId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.config;

  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const settings = settingsMap(await listProjectSettings(projectId));
  const brandName =
    (typeof settings.brand_name === 'string' && settings.brand_name) ||
    project.brand_name ||
    project.name;

  const brandKnowledge =
    typeof settings.brand_knowledge === 'string'
      ? settings.brand_knowledge
      : typeof settings.brand_knowledge === 'object' &&
          settings.brand_knowledge &&
          'markdown' in (settings.brand_knowledge as object)
        ? String((settings.brand_knowledge as { markdown: string }).markdown)
        : '';

  const waEnabledSetting = settings.whatsapp_enabled;
  const fbEnabledSetting = settings.facebook_enabled;

  const [
    llmKey,
    waToken,
    waPhoneId,
    waBizId,
    waOwner,
    waVerify,
    fbToken,
    fbPageId,
  ] = await Promise.all([
    getProjectSecret(projectId, 'llm_api_key'),
    getProjectSecret(projectId, 'whatsapp_access_token'),
    getProjectSecret(projectId, 'whatsapp_phone_number_id'),
    getProjectSecret(projectId, 'whatsapp_business_account_id'),
    getProjectSecret(projectId, 'whatsapp_owner_phone'),
    getProjectSecret(projectId, 'whatsapp_verify_token'),
    getProjectSecret(projectId, 'facebook_page_access_token'),
    getProjectSecret(projectId, 'facebook_page_id'),
  ]);

  const llmProvider =
    typeof settings.llm_provider === 'string' ? settings.llm_provider : 'minimax';
  const llmModel =
    typeof settings.llm_model === 'string' ? settings.llm_model : '';
  const llmBaseUrl =
    typeof settings.llm_base_url === 'string' ? settings.llm_base_url : '';

  const waConfigured = Boolean(waToken && waPhoneId);
  const fbConfigured = Boolean(fbToken && fbPageId);
  const llmConfigured = Boolean(llmKey && llmModel && llmBaseUrl);

  const config: ProjectConfig = {
    project,
    brandName,
    brandKnowledge,
    huntLocations: settings.hunt_locations ?? null,
    ctaUrl:
      typeof settings.whatsapp_cta_url === 'string'
        ? settings.whatsapp_cta_url
        : undefined,
    llm: {
      provider: llmProvider,
      apiKey: llmKey ?? undefined,
      model: llmModel || undefined,
      baseUrl: llmBaseUrl || undefined,
      configured: llmConfigured,
    },
    whatsapp: {
      enabled: typeof waEnabledSetting === 'boolean' ? waEnabledSetting : waConfigured,
      configured: waConfigured,
      accessToken: waToken ?? undefined,
      phoneNumberId: waPhoneId ?? undefined,
      businessAccountId: waBizId ?? undefined,
      ownerPhone: waOwner ?? undefined,
      verifyToken: waVerify ?? undefined,
      handoffKeywords:
        typeof settings.whatsapp_handoff_keywords === 'string'
          ? settings.whatsapp_handoff_keywords
          : '',
    },
    facebook: {
      enabled:
        typeof fbEnabledSetting === 'boolean' ? fbEnabledSetting : fbConfigured,
      configured: fbConfigured,
      dryRun:
        typeof settings.facebook_dry_run === 'boolean'
          ? settings.facebook_dry_run
          : true,
      autoPublish:
        typeof settings.facebook_auto_publish === 'boolean'
          ? settings.facebook_auto_publish
          : false,
      pageId: fbPageId ?? undefined,
      pageAccessToken: fbToken ?? undefined,
    },
  };

  cache.set(projectId, { at: Date.now(), config });
  return config;
}

/** Platform bootstrap config from env (no tenant context). */
export function loadBootstrapConfig(): {
  llm: ProjectConfig['llm'];
  whatsapp: ProjectConfig['whatsapp'];
  facebook: ProjectConfig['facebook'];
} {
  return {
    llm: {
      provider: env.LLM_PROVIDER,
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
      baseUrl: env.LLM_BASE_URL,
      configured: Boolean(env.LLM_API_KEY && env.LLM_BASE_URL && env.LLM_MODEL),
    },
    whatsapp: {
      enabled: env.WHATSAPP_ENABLED,
      configured: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      ownerPhone: env.WHATSAPP_OWNER_PHONE,
      handoffKeywords: env.WHATSAPP_HANDOFF_KEYWORDS,
    },
    facebook: {
      enabled: env.FB_PUBLISHER_ENABLED,
      configured: Boolean(env.FB_PAGE_ACCESS_TOKEN && env.FB_PAGE_ID),
      dryRun: env.FB_DRY_RUN,
      autoPublish: env.FB_AUTO_PUBLISH,
      pageId: env.FB_PAGE_ID,
      pageAccessToken: env.FB_PAGE_ACCESS_TOKEN,
    },
  };
}

export async function loadCurrentProjectConfig(): Promise<ProjectConfig> {
  const ctx = requireTenant();
  return loadProjectConfig(ctx.projectId);
}

export async function tryLoadCurrentProjectConfig(): Promise<ProjectConfig | null> {
  const ctx = getTenant();
  if (!ctx?.projectId) return null;
  return loadProjectConfig(ctx.projectId);
}

export async function getSettingOrNull<T>(
  key: string,
): Promise<T | null> {
  const ctx = getTenant();
  if (!ctx?.projectId) return null;
  return getProjectSetting<T>(ctx.projectId, key);
}
