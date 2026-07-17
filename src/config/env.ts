import { config as loadDotenv } from 'dotenv';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

loadDotenv();

// Some sandboxed dev shells (Cursor) point PLAYWRIGHT_BROWSERS_PATH at an
// ephemeral per-session cache with no browsers installed. Force the stable,
// already-provisioned location on Windows dev machines. Linux/production
// installs keep whatever the install step configured (default OS path).
if (
  process.platform === 'win32' &&
  process.env.NODE_ENV !== 'production' &&
  (!process.env.PLAYWRIGHT_BROWSERS_PATH ||
    process.env.PLAYWRIGHT_BROWSERS_PATH.includes('cursor-sandbox-cache'))
) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
    os.homedir(),
    'AppData',
    'Local',
    'ms-playwright',
  );
}

const booleanFromEnv = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return false;
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4100),

  MATUDB_URL: z.string().url(),
  MATUDB_PROJECT_ID: z.string().min(1, 'MATUDB_PROJECT_ID is required'),
  MATUDB_API_KEY: z.string().min(1, 'MATUDB_API_KEY is required'),
  MATUDB_SERVICE_KEY: z.string().min(1).optional(),

  // 'api' se mantiene como alias histórico; en runtime siempre es MiniMax.
  LLM_PROVIDER: z
    .enum(['minimax', 'api'])
    .default('minimax')
    .transform(() => 'minimax' as const),
  LLM_BASE_URL: z
    .string()
    .url()
    .default('https://api.minimax.io/v1')
    .refine(
      (value) => new URL(value).hostname === 'api.minimax.io',
      'LLM_BASE_URL debe usar api.minimax.io',
    ),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required'),
  LLM_MODEL: z
    .string()
    .regex(/^MiniMax-/, 'LLM_MODEL debe ser un modelo MiniMax')
    .default('MiniMax-M3'),

  HEADLESS_MODE: booleanFromEnv,
  WHATSAPP_CTA_URL: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().url().optional(),
  ),

  // WhatsApp Cloud API (Meta) — https://developers.facebook.com/docs/whatsapp/cloud-api
  WHATSAPP_ENABLED: booleanFromEnv,
  WHATSAPP_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().or(z.literal('')),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().or(z.literal('')),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).default('matubyte_verify_token'),
  META_APP_SECRET: z.string().optional().or(z.literal('')),
  WHATSAPP_API_VERSION: z.string().min(1).default('v21.0'),
  WHATSAPP_HANDOFF_KEYWORDS: z
    .string()
    .min(1)
    .default('hablar con alguien,agente humano,asesor,hablar con una persona,humano por favor'),

  // Facebook Pages API (Meta Graph) — agente facebook-publisher
  // Documentación: https://developers.facebook.com/docs/pages-api
  FB_PUBLISHER_ENABLED: booleanFromEnv,
  FB_DRY_RUN: booleanFromEnv,
  /** true = publica al generar; false = deja pending_review para /facebook.html */
  FB_AUTO_PUBLISH: booleanFromEnv,
  FB_PAGE_ID: z.string().optional().or(z.literal('')),
  FB_PAGE_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  FB_GRAPH_VERSION: z.string().min(1).default('v21.0'),

  // Facebook Webhooks — recibe eventos de la página (comentarios, reactions,
  // feed, leadgen, messenger). Requiere URL HTTPS pública (usa ngrok en dev).
  FB_WEBHOOK_ENABLED: booleanFromEnv,
  FB_WEBHOOK_VERIFY_TOKEN: z.string().min(1).default('matubyte_fb_verify_token'),

  LEAD_HUNTER_CITY: z.string().min(1).default('Cali'),
  LEAD_HUNTER_SECTOR: z.string().optional().or(z.literal('')),
  LEAD_HUNTER_QUERY: z.string().optional().or(z.literal('')),
  LEAD_HUNTER_MAX_RESULTS: z.coerce.number().int().positive().max(40).default(12),

  AUTO_START_AGENTS: booleanFromEnv,
  AUTO_START_DELAY_MS: z.coerce.number().int().nonnegative().default(8000),
  AUTO_HUNT_INTERVAL_MS: z.coerce.number().int().positive().default(900000),

  CRON_LEAD_HUNTER: z.string().min(1).default('0 */6 * * *'),
  CRON_OPPORTUNITY_SCOUT: z.string().min(1).default('30 */6 * * *'),
  CRON_INFILTRATOR: z.string().min(1).default('0 */4 * * *'),
  CRON_CONTENT_RADAR: z.string().min(1).default('0 7 * * *'),
  CRON_CATALOG_CURATOR: z.string().min(1).default('0 6 * * *'),
  CRON_EDITORIAL_PLANNER: z.string().min(1).default('30 6 * * *'),
  CRON_BLOG_WRITER: z.string().min(1).default('0 8 * * *'),
  CRON_SOCIAL_CREATOR: z.string().min(1).default('0 9 * * *'),
  CRON_COMMUNITY_AGENT: z.string().min(1).default('0 */3 * * *'),
  CRON_FACEBOOK_PUBLISHER: z.string().min(1).default('0 10,16,22 * * *'),
});

export type Env = z.infer<typeof envSchema> & {
  LEAD_HUNTER_SECTOR?: string;
  LEAD_HUNTER_QUERY?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_BUSINESS_ACCOUNT_ID?: string;
  META_APP_SECRET?: string;
  FB_PAGE_ID?: string;
  FB_PAGE_ACCESS_TOKEN?: string;
};

function loadEnv(): Env {
  if (!process.env.LLM_PROVIDER) {
    process.env.LLM_PROVIDER = 'minimax';
  }

  if (process.env.AUTO_START_AGENTS === undefined) {
    process.env.AUTO_START_AGENTS = 'true';
  }

  // Default headless=true so console/Linux servers never try to open a window.
  if (process.env.HEADLESS_MODE === undefined || process.env.HEADLESS_MODE === '') {
    process.env.HEADLESS_MODE = 'true';
  }

  // Default FB_DRY_RUN=true en dev para evitar publicaciones accidentales.
  // En prod el usuario debe ponerlo false explícitamente.
  if (process.env.FB_DRY_RUN === undefined || process.env.FB_DRY_RUN === '') {
    process.env.FB_DRY_RUN = 'true';
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return {
    ...parsed.data,
    WHATSAPP_CTA_URL: parsed.data.WHATSAPP_CTA_URL || undefined,
    LEAD_HUNTER_SECTOR: parsed.data.LEAD_HUNTER_SECTOR || undefined,
    LEAD_HUNTER_QUERY: parsed.data.LEAD_HUNTER_QUERY || undefined,
    MATUDB_SERVICE_KEY: parsed.data.MATUDB_SERVICE_KEY || undefined,
    WHATSAPP_ACCESS_TOKEN: parsed.data.WHATSAPP_ACCESS_TOKEN || undefined,
    WHATSAPP_PHONE_NUMBER_ID: parsed.data.WHATSAPP_PHONE_NUMBER_ID || undefined,
    WHATSAPP_BUSINESS_ACCOUNT_ID: parsed.data.WHATSAPP_BUSINESS_ACCOUNT_ID || undefined,
    META_APP_SECRET: parsed.data.META_APP_SECRET || undefined,
    FB_PAGE_ID: parsed.data.FB_PAGE_ID || undefined,
    FB_PAGE_ACCESS_TOKEN: parsed.data.FB_PAGE_ACCESS_TOKEN || undefined,
  };
}

export const env = loadEnv();
