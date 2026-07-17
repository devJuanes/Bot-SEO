import { db } from './matu.js';
import { getMatuByteKnowledge } from '../knowledge/matubyte.js';
import { pickCoverImage } from '../knowledge/blog-images.js';
import { listRecentLeads } from './leads.js';
import { withRetry } from '../utils/retry.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  system_prompt: string | null;
  is_chat_enabled: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface OpportunityInsert {
  external_id?: string | null;
  source: string;
  opportunity_type: string;
  title: string;
  company_name?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  source_url?: string | null;
  contact_hint?: string | null;
  needs_software?: boolean;
  score?: number;
  tags?: string[];
  raw_data?: Record<string, unknown>;
}

export interface AppConnection {
  id: string;
  name: string;
  slug: string;
  platform: string;
  app_url: string | null;
  access_token: string | null;
  description: string | null;
  features: unknown;
  brand_voice: string | null;
  is_active: boolean;
}

const DEFAULT_AGENTS: Array<Omit<AgentDefinition, 'is_active'> & { is_active?: boolean }> = [
  {
    id: 'lead-hunter',
    name: 'Agente Cazador de Leads',
    role: 'hunter',
    description:
      'Escanea Google Maps (CO + LatAm) buscando negocios sin web u oportunidad de app/CRM.',
    capabilities: ['maps', 'dedupe', 'needs_website'],
    system_prompt:
      'Eres el Cazador de MatuByte. Hablas de prospección Maps, nichos y anti-duplicados. Sé concreto.',
    is_chat_enabled: true,
    sort_order: 1,
  },
  {
    id: 'opportunity-scout',
    name: 'Agente Scout de Oportunidades',
    role: 'scout',
    description:
      'Busca demanda en empleos, contrataciones públicas, alcaldías y foros (software/apps/automatización).',
    capabilities: ['jobs', 'gov', 'forums', 'reddit'],
    system_prompt:
      'Eres el Scout de MatuByte. Detectas señales de compra en empleos, RFP/gov y foros. Explica hallazgos.',
    is_chat_enabled: true,
    sort_order: 2,
  },
  {
    id: 'infiltrator',
    name: 'Agente Infiltrado',
    role: 'social',
    description: 'Monitorea hilos en redes/foros y responde con valor + CTA MatuByte.',
    capabilities: ['forums', 'reply', 'cta'],
    system_prompt:
      'Eres el Infiltrado de MatuByte. Respuestas humanas, alto valor técnico, sin spam.',
    is_chat_enabled: true,
    sort_order: 3,
  },
  {
    id: 'content-radar',
    name: 'Agente Radar & Estratega',
    role: 'strategist',
    description: 'Analiza tendencias y prepara briefs para redes y blogs.',
    capabilities: ['trends', 'briefs'],
    system_prompt: 'Eres el Radar de MatuByte. Das briefs de contenido accionables.',
    is_chat_enabled: true,
    sort_order: 4,
  },
  {
    id: 'catalog-curator',
    name: 'Agente Curador de Catálogo',
    role: 'catalog_curator',
    description:
      'Rota productos del catálogo (MatuCourse, Parking, CMR, MatuSendMail, MatuPDF, EBook, MatuCash, MatuPicks, MatuDB, desarrollo a medida) y el aliado FymApp; deja briefs/drafts para aprobación manual.',
    capabilities: ['catalog', 'rotation', 'briefs', 'drafts', 'manual_approval'],
    system_prompt:
      'Eres el Curador de Catálogo de MatuByte. Rotas productos, evitas repetición, value-first. FymApp es aliado DIAN, no producto propio. No auto-publicas.',
    is_chat_enabled: true,
    sort_order: 5,
  },
  {
    id: 'editorial-planner',
    name: 'Agente Planificador Editorial',
    role: 'editorial_planner',
    description:
      'Planifica briefs diversificados por audiencia (educación, general, emprendedores, developers, trends, casos de uso, comercial) con mayoría educativa y máximo un CTA de producto.',
    capabilities: ['editorial', 'pillars', 'briefs', 'anti_spam', 'manual_approval'],
    system_prompt:
      'Eres el Planificador Editorial de MatuByte. Diversificas pilares, mayoría educativa, ≤1 producto/CTA por lote. Solo cola manual.',
    is_chat_enabled: true,
    sort_order: 6,
  },
  {
    id: 'blog-writer',
    name: 'Agente Redactor de Blogs',
    role: 'writer',
    description: 'Genera artículos SEO local MatuByte y los guarda en blog_posts.',
    capabilities: ['seo', 'blog', 'llm'],
    system_prompt:
      'Eres el Redactor SEO de MatuByte (Cali). Artículos útiles para emprendedores, developers y público general, con CTA WhatsApp suave.',
    is_chat_enabled: true,
    sort_order: 7,
  },
  {
    id: 'social-creator',
    name: 'Agente Creador de Contenido',
    role: 'social_creator',
    description:
      'Crea posts/scripts para Instagram/Facebook/TikTok rotando fichas del catálogo / app_connections activas (no solo la más nueva).',
    capabilities: ['instagram', 'facebook', 'tiktok', 'app_tokens', 'rotation'],
    system_prompt:
      'Eres el Creador Social de MatuByte. Generas copies cortos, hooks y hashtags por plataforma. Rotas productos y priorizas valor.',
    is_chat_enabled: true,
    sort_order: 8,
  },
  {
    id: 'community-agent',
    name: 'Agente Comunidad',
    role: 'community',
    description:
      'Participa en el foro público de matubyte.com/foro: responde temas o abre nuevos junto a los visitantes.',
    capabilities: ['forum', 'reply', 'thread_creation'],
    system_prompt:
      'Eres el Agente Comunidad de MatuByte. Participas como un miembro más del foro, útil y sin spam.',
    is_chat_enabled: true,
    sort_order: 9,
  },
  {
    id: 'facebook-publisher',
    name: 'Agente Facebook Publisher',
    role: 'facebook_publisher',
    description:
      'Detecta tendencias, genera posts diversificados y los deja en cola de aprobación (manual por defecto) o publica si auto está activo.',
    capabilities: ['facebook', 'trends', 'meta_graph', 'publish', 'rotation'],
    system_prompt:
      'Eres el Publisher de Facebook de MatuByte. Creas posts value-first, rotas productos/tendencias, sin spam. FymApp solo como aliado DIAN.',
    is_chat_enabled: true,
    sort_order: 10,
  },
];

/** Inserta agentes nuevos y actualiza nombre/descripcion/prompt/capabilities de los existentes. */
export async function seedAgentDefinitions(): Promise<void> {
  for (const agent of DEFAULT_AGENTS) {
    const existing = await db
      .from('agent_definitions')
      .select('id')
      .eq('id', agent.id)
      .limit(1);

    if (existing.error) {
      throw new Error(`seedAgentDefinitions read failed: ${errMsg(existing.error)}`);
    }

    const payload = {
      name: agent.name,
      role: agent.role,
      description: agent.description,
      capabilities: agent.capabilities,
      system_prompt: agent.system_prompt,
      is_chat_enabled: agent.is_chat_enabled,
      sort_order: agent.sort_order,
    };

    if ((existing.data ?? []).length > 0) {
      const { error } = await db
        .from('agent_definitions')
        .eq('id', agent.id)
        .update(payload);
      if (error) {
        throw new Error(`seedAgentDefinitions update failed: ${errMsg(error)}`);
      }
      continue;
    }

    const { error } = await db.from('agent_definitions').insert({
      id: agent.id,
      ...payload,
      is_active: true,
    });

    if (error) {
      throw new Error(`seedAgentDefinitions insert failed: ${errMsg(error)}`);
    }
  }
}

/** Ensures social-creator has at least one product card to write about. */
export async function seedDefaultAppConnection(): Promise<void> {
  const apps = await listAppConnections().catch(() => []);
  if (apps.length > 0) return;

  await createAppConnection({
    name: 'MatuByte Platform',
    slug: 'matubyte',
    platform: 'web_app',
    app_url: 'https://matubyte.com',
    description:
      'Suite de software MatuByte S.A.S.: MatuCourse, MatuPark/Parking, CMR, MatuSendMail, MatuPDF, EBook App, MatuCash, MatuPicks, MatuDB, desarrollo a medida; aliado recomendado FymApp (ERP/DIAN, no propio).',
    features: [
      'MatuCourse / EBook',
      'CMR / MatuCash',
      'MatuDB / MatuPDF / MatuSendMail',
      'Parking / MatuPicks',
      'desarrollo a medida',
    ],
    brand_voice: 'técnico, cercano, value-first, desde Cali',
  });
}

export async function listAgentDefinitions(): Promise<AgentDefinition[]> {
  const { data, error } = await db
    .from('agent_definitions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`listAgentDefinitions: ${errMsg(error)}`);
  return (data ?? []) as AgentDefinition[];
}

export async function getAgentDefinition(id: string): Promise<AgentDefinition | null> {
  const { data, error } = await db
    .from('agent_definitions')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) throw new Error(`getAgentDefinition: ${errMsg(error)}`);
  return ((data ?? [])[0] as AgentDefinition | undefined) ?? null;
}

export async function saveChatMessage(input: {
  agentId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}): Promise<void> {
  const { error } = await db.from('agent_chat_messages').insert({
    agent_id: input.agentId,
    session_id: input.sessionId,
    role: input.role,
    content: input.content,
  });
  if (error) throw new Error(`saveChatMessage: ${errMsg(error)}`);
}

export async function listChatMessages(
  agentId: string,
  sessionId: string,
  limit = 40,
): Promise<Array<{ role: string; content: string; created_at: string }>> {
  const { data, error } = await db
    .from('agent_chat_messages')
    .select('role, content, created_at')
    .eq('agent_id', agentId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`listChatMessages: ${errMsg(error)}`);
  return (data ?? []) as Array<{ role: string; content: string; created_at: string }>;
}

export async function upsertOpportunity(row: OpportunityInsert): Promise<{
  action: 'inserted' | 'skipped_duplicate';
}> {
  if (row.external_id) {
    const { data, error } = await db
      .from('opportunities')
      .select('id')
      .eq('source', row.source)
      .eq('external_id', row.external_id)
      .limit(1);
    if (error) throw new Error(`upsertOpportunity find: ${errMsg(error)}`);
    if ((data ?? []).length > 0) return { action: 'skipped_duplicate' };
  }

  const { error } = await db.from('opportunities').insert({
    ...row,
    needs_software: row.needs_software ?? true,
    status: 'new',
    country: row.country ?? 'CO',
  });
  if (error) throw new Error(`upsertOpportunity insert: ${errMsg(error)}`);
  return { action: 'inserted' };
}

export async function listOpportunities(limit = 40): Promise<Record<string, unknown>[]> {
  const { data, error } = await db
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listOpportunities: ${errMsg(error)}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function listAppConnections(): Promise<AppConnection[]> {
  const { data, error } = await db
    .from('app_connections')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listAppConnections: ${errMsg(error)}`);
  return (data ?? []) as AppConnection[];
}

export async function getAppBySlug(slug: string): Promise<AppConnection | null> {
  const { data, error } = await db
    .from('app_connections')
    .select('*')
    .eq('slug', slug)
    .limit(1);
  if (error) throw new Error(`getAppBySlug: ${errMsg(error)}`);
  return ((data ?? [])[0] as AppConnection | undefined) ?? null;
}

export async function createAppConnection(input: {
  name: string;
  slug: string;
  platform?: string;
  app_url?: string;
  access_token?: string;
  description?: string;
  features?: unknown;
  brand_voice?: string;
}): Promise<AppConnection> {
  const featuresJson =
    typeof input.features === 'string'
      ? input.features
      : JSON.stringify(input.features ?? []);

  const { data, error } = await db.from('app_connections').insert({
    name: input.name,
    slug: input.slug,
    platform: input.platform ?? 'custom',
    app_url: input.app_url ?? null,
    access_token: input.access_token ?? null,
    description: input.description ?? null,
    features: featuresJson,
    brand_voice: input.brand_voice ?? null,
    is_active: true,
  });
  if (error) throw new Error(`createAppConnection: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as AppConnection | undefined;
  if (!row) throw new Error('createAppConnection returned empty');
  return row;
}

export async function listSiteKnowledge(): Promise<
  Array<{ key: string; title: string; content: string; source_url: string | null }>
> {
  const { data, error } = await db
    .from('site_knowledge')
    .select('key, title, content, source_url')
    .eq('is_active', true);
  if (error) throw new Error(`listSiteKnowledge: ${errMsg(error)}`);
  return (data ?? []) as Array<{
    key: string;
    title: string;
    content: string;
    source_url: string | null;
  }>;
}

export async function upsertSiteKnowledge(input: {
  key: string;
  title: string;
  content: string;
  source_url?: string;
}): Promise<void> {
  const existing = await db
    .from('site_knowledge')
    .select('id')
    .eq('key', input.key)
    .limit(1);

  if (existing.error) throw new Error(`upsertSiteKnowledge find: ${errMsg(existing.error)}`);

  if ((existing.data ?? []).length > 0) {
    const id = (existing.data as Array<{ id: string }>)[0]!.id;
    const { error } = await db
      .from('site_knowledge')
      .eq('id', id)
      .update({
        title: input.title,
        content: input.content,
        source_url: input.source_url ?? null,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(`upsertSiteKnowledge update: ${errMsg(error)}`);
    return;
  }

  const { error } = await db.from('site_knowledge').insert({
    key: input.key,
    title: input.title,
    content: input.content,
    source_url: input.source_url ?? null,
    is_active: true,
  });
  if (error) throw new Error(`upsertSiteKnowledge insert: ${errMsg(error)}`);
}

export async function buildKnowledgeContext(): Promise<string> {
  const fileKnowledge = getMatuByteKnowledge();
  const rows = await listSiteKnowledge().catch(() => []);
  const dbBlock = rows
    .map((row) => `### ${row.title} (${row.key})\n${row.content}`)
    .join('\n\n');

  return `${fileKnowledge}\n\n## Knowledge DB\n${dbBlock || '(vacío — carga /api/knowledge)'}`;
}

export async function insertContentScript(input: {
  platform: string;
  topic: string;
  hook?: string;
  script_body: string;
  seo_copy?: string;
  hashtags?: string[];
  metadata?: Record<string, unknown>;
  /** Tracking de Facebook — todos opcionales para no romper otros agentes */
  fb_photo_url?: string | null;
  trend_source?: string | null;
  trend_url?: string | null;
  publish_status?: 'draft' | 'pending_review' | 'approved' | 'published' | 'failed' | 'skipped';
  seo_title?: string | null;
  seo_keywords?: string[];
}): Promise<string | null> {
  const { data, error } = await withRetry<{ error: unknown; data: unknown }>(() =>
    db.from('content_scripts').insert({
      platform: input.platform,
      topic: input.topic,
      hook: input.hook ?? null,
      script_body: input.script_body,
      seo_copy: input.seo_copy ?? null,
      seo_title: input.seo_title ?? null,
      seo_keywords: input.seo_keywords ?? [],
      hashtags: input.hashtags ?? [],
      status: 'draft',
      metadata: input.metadata ?? {},
      fb_photo_url: input.fb_photo_url ?? null,
      trend_source: input.trend_source ?? null,
      trend_url: input.trend_url ?? null,
      publish_status: input.publish_status ?? 'draft',
    }),
  );
  if (error) throw new Error(`insertContentScript: ${errMsg(error)}`);
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | undefined;
  return row?.id ?? null;
}

/**
 * Update del estado de publicación de Facebook sobre un content_script existente.
 * Se llama desde el agente tras pegar a Meta, o desde el endpoint /retry.
 */
export interface FbPublishPatch {
  fb_post_id?: string;
  fb_permalink_url?: string;
  fb_published_at?: string;
  publish_status?:
    | 'draft'
    | 'pending_review'
    | 'approved'
    | 'published'
    | 'failed'
    | 'skipped';
  error_message?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_reason?: string | null;
  script_body?: string;
  hook?: string;
  topic?: string;
  hashtags?: string[];
  fb_photo_url?: string | null;
  seo_title?: string | null;
  seo_keywords?: string[];
  /** Se fusiona con metadata existente para no borrar datos del generador. */
  metadata?: Record<string, unknown>;
}

export async function updateContentScriptFb(
  id: string,
  patch: FbPublishPatch,
): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (patch.fb_post_id !== undefined) clean.fb_post_id = patch.fb_post_id;
  if (patch.fb_permalink_url !== undefined) clean.fb_permalink_url = patch.fb_permalink_url;
  if (patch.fb_published_at !== undefined) clean.fb_published_at = patch.fb_published_at;
  if (patch.publish_status !== undefined) clean.publish_status = patch.publish_status;
  if (patch.error_message !== undefined) clean.error_message = patch.error_message;
  if (patch.approved_at !== undefined) clean.approved_at = patch.approved_at;
  if (patch.approved_by !== undefined) clean.approved_by = patch.approved_by;
  if (patch.rejected_reason !== undefined) clean.rejected_reason = patch.rejected_reason;
  if (patch.script_body !== undefined) clean.script_body = patch.script_body;
  if (patch.hook !== undefined) clean.hook = patch.hook;
  if (patch.topic !== undefined) clean.topic = patch.topic;
  if (patch.hashtags !== undefined) clean.hashtags = patch.hashtags;
  if (patch.fb_photo_url !== undefined) clean.fb_photo_url = patch.fb_photo_url;
  if (patch.seo_title !== undefined) clean.seo_title = patch.seo_title;
  if (patch.seo_keywords !== undefined) clean.seo_keywords = patch.seo_keywords;
  if (patch.metadata !== undefined) {
    const current = await getContentScriptById(id);
    const currentMetadata =
      current?.metadata && typeof current.metadata === 'object'
        ? (current.metadata as Record<string, unknown>)
        : {};
    clean.metadata = { ...currentMetadata, ...patch.metadata };
  }
  clean.updated_at = new Date().toISOString();

  const { error } = await db.from('content_scripts').eq('id', id).update(clean);
  if (error) throw new Error(`updateContentScriptFb: ${errMsg(error)}`);
}

export type FacebookPublisherSettings = {
  mode: 'manual' | 'auto';
  auto_publish: boolean;
  default_hashtags?: string[];
  notes?: string;
};

const DEFAULT_FB_SETTINGS: FacebookPublisherSettings = {
  mode: 'manual',
  auto_publish: false,
  default_hashtags: ['#MatuByte', '#Software', '#Colombia'],
};

export async function getBotSetting<T = Record<string, unknown>>(
  key: string,
): Promise<T | null> {
  const { data, error } = await db
    .from('bot_settings')
    .select('value')
    .eq('key', key)
    .limit(1);
  if (error) throw new Error(`getBotSetting: ${errMsg(error)}`);
  const row = (data ?? [])[0] as { value?: T } | undefined;
  return row?.value ?? null;
}

export async function upsertBotSetting(
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  const existing = await db
    .from('bot_settings')
    .select('key')
    .eq('key', key)
    .limit(1);
  if (existing.error) throw new Error(`upsertBotSetting find: ${errMsg(existing.error)}`);
  const row = (existing.data ?? [])[0];
  if (row) {
    const { error } = await db
      .from('bot_settings')
      .eq('key', key)
      .update({ value, updated_at: new Date().toISOString() });
    if (error) throw new Error(`upsertBotSetting update: ${errMsg(error)}`);
    return;
  }
  const { error } = await db.from('bot_settings').insert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`upsertBotSetting insert: ${errMsg(error)}`);
}

export async function getFacebookPublisherSettings(): Promise<FacebookPublisherSettings> {
  const stored = await getBotSetting<Partial<FacebookPublisherSettings>>(
    'facebook_publisher',
  ).catch(() => null);
  return {
    ...DEFAULT_FB_SETTINGS,
    ...stored,
    mode: stored?.mode === 'auto' ? 'auto' : 'manual',
    auto_publish: Boolean(stored?.auto_publish),
  };
}

export async function listFacebookPosts(opts?: {
  status?: string;
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 30));
  let q = db
    .from('content_scripts')
    .select('*')
    .eq('platform', 'facebook')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (opts?.status) {
    q = q.eq('publish_status', opts.status);
  }
  const { data, error } = await q;
  if (error) throw new Error(`listFacebookPosts: ${errMsg(error)}`);
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Devuelve las URLs de trend_url usadas en los últimos N días.
 * Sirve para que el agente no repita tendencia.
 */
export async function listRecentTrendUrls(daysBack = 7): Promise<string[]> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from('content_scripts')
    .select('trend_url')
    .eq('platform', 'facebook')
    .not('trend_url', 'is', null)
    .gte('created_at', since);
  if (error) throw new Error(`listRecentTrendUrls: ${errMsg(error)}`);
  return ((data ?? []) as Array<{ trend_url: string }>)
    .map((row) => row.trend_url)
    .filter(Boolean);
}

export async function listFailedFbPosts(limit = 20): Promise<
  Array<Record<string, unknown>>
> {
  const { data, error } = await db
    .from('content_scripts')
    .select('*')
    .eq('platform', 'facebook')
    .eq('publish_status', 'failed')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listFailedFbPosts: ${errMsg(error)}`);
  return (data ?? []) as Array<Record<string, unknown>>;
}

export async function getContentScriptById(
  id: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db
    .from('content_scripts')
    .select('*')
    .eq('id', id)
    .limit(1);
  if (error) throw new Error(`getContentScriptById: ${errMsg(error)}`);
  return ((data ?? [])[0] as Record<string, unknown> | undefined) ?? null;
}

export async function insertBlogPost(input: {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  city?: string;
  sector?: string;
  /** Fully autonomous pipeline: publish immediately so matubyte.com/blog shows it. */
  status?: 'draft' | 'published';
}): Promise<void> {
  const status = input.status ?? 'published';
  const cover = pickCoverImage({
    sector: input.sector,
    keywords: input.seo_keywords,
    title: input.title,
  });

  const { error } = await withRetry<{ error: unknown }>(() =>
    db.from('blog_posts').insert({
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt ?? null,
      content: input.content,
      seo_title: input.seo_title ?? input.title,
      seo_description: input.seo_description ?? null,
      seo_keywords: input.seo_keywords ?? [],
      city: input.city ?? 'Cali',
      sector: input.sector ?? null,
      cover_image: cover.url,
      cover_image_alt: cover.alt,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    }),
  );
  if (error) throw new Error(`insertBlogPost: ${errMsg(error)}`);
}

export async function listBlogPosts(limit = 20): Promise<Record<string, unknown>[]> {
  const { data, error } = await db
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listBlogPosts: ${errMsg(error)}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function listContentScripts(limit = 20): Promise<Record<string, unknown>[]> {
  const { data, error } = await db
    .from('content_scripts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listContentScripts: ${errMsg(error)}`);
  return (data ?? []) as Record<string, unknown>[];
}

export interface ContentBrief {
  id: string;
  source_agent: string;
  title: string;
  problem: string | null;
  trend: string | null;
  angle: string;
  city: string | null;
  country: string | null;
  sector: string | null;
  priority: number;
  status: string;
  metadata: Record<string, unknown> | null;
}

export async function insertContentBrief(input: {
  source_agent: string;
  title: string;
  problem?: string;
  trend?: string;
  angle: string;
  city?: string;
  country?: string;
  sector?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await withRetry<{ error: unknown }>(() =>
    db.from('content_briefs').insert({
      source_agent: input.source_agent,
      title: input.title,
      problem: input.problem ?? null,
      trend: input.trend ?? null,
      angle: input.angle,
      city: input.city ?? null,
      country: input.country ?? 'CO',
      sector: input.sector ?? null,
      priority: input.priority ?? 50,
      status: 'pending',
      metadata: input.metadata ?? {},
    }),
  );
  if (error) throw new Error(`insertContentBrief: ${errMsg(error)}`);
}

export async function claimNextContentBrief(): Promise<ContentBrief | null> {
  const { data, error } = await db
    .from('content_briefs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) throw new Error(`claimNextContentBrief: ${errMsg(error)}`);
  const rows = (data ?? []) as ContentBrief[];
  const row =
    [...rows].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0] ?? null;
  if (!row) return null;

  const { error: updateError } = await db
    .from('content_briefs')
    .eq('id', row.id)
    .eq('status', 'pending')
    .update({
      status: 'writing',
      updated_at: new Date().toISOString(),
    });

  if (updateError) throw new Error(`claimNextContentBrief update: ${errMsg(updateError)}`);
  return { ...row, status: 'writing' };
}

export async function completeContentBrief(
  id: string,
  status: 'done' | 'discarded' | 'pending' = 'done',
): Promise<void> {
  const { error } = await db
    .from('content_briefs')
    .eq('id', id)
    .update({
      status,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(`completeContentBrief: ${errMsg(error)}`);
}

export async function listPendingBriefs(limit = 20): Promise<ContentBrief[]> {
  const { data, error } = await db
    .from('content_briefs')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPendingBriefs: ${errMsg(error)}`);
  return (data ?? []) as ContentBrief[];
}

export async function gatherMarketSignals(): Promise<{
  leadsSummary: string;
  opportunitiesSummary: string;
  sectors: string[];
  cities: string[];
}> {
  const leads = await listRecentLeads(40).catch(() => []);
  const opps = await listOpportunities(25).catch(() => []);

  const sectors = [
    ...new Set(
      leads
        .map((l) => l.business_type)
        .filter((v): v is string => Boolean(v)),
    ),
  ].slice(0, 12);

  const cities = [
    ...new Set(leads.map((l) => l.city).filter((v): v is string => Boolean(v))),
  ].slice(0, 12);

  const leadsSummary = leads
    .slice(0, 15)
    .map(
      (l) =>
        `- ${l.name} | ${l.business_type ?? '?'} | ${l.city ?? '?'} | needs_website=${l.needs_website} | phone=${l.phone ?? 'n/a'}`,
    )
    .join('\n');

  const opportunitiesSummary = opps
    .slice(0, 12)
    .map((o) => {
      const row = o as Record<string, unknown>;
      return `- [${String(row.opportunity_type)}] ${String(row.title)} | ${String(row.source)} | ${String(row.city ?? '')}`;
    })
    .join('\n');

  return { leadsSummary, opportunitiesSummary, sectors, cities };
}

