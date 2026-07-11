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
    id: 'blog-writer',
    name: 'Agente Redactor de Blogs',
    role: 'writer',
    description: 'Genera artículos SEO local MatuByte y los guarda en blog_posts.',
    capabilities: ['seo', 'blog', 'llm'],
    system_prompt:
      'Eres el Redactor SEO de MatuByte (Cali). Artículos útiles, locales, con CTA WhatsApp.',
    is_chat_enabled: true,
    sort_order: 5,
  },
  {
    id: 'social-creator',
    name: 'Agente Creador de Contenido',
    role: 'social_creator',
    description:
      'Crea posts/scripts para Instagram/Facebook/TikTok usando tokens y ficha de cada app Matu*.',
    capabilities: ['instagram', 'facebook', 'tiktok', 'app_tokens'],
    system_prompt:
      'Eres el Creador Social de MatuByte. Generas copies cortos, hooks y hashtags por plataforma.',
    is_chat_enabled: true,
    sort_order: 6,
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
    sort_order: 7,
  },
];

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

    if ((existing.data ?? []).length > 0) continue;

    const { error } = await db.from('agent_definitions').insert({
      ...agent,
      is_active: true,
      capabilities: agent.capabilities,
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
      'Suite de software MatuByte S.A.S.: apps a medida, MatuDB, MatuCRM, Matu AI, automatizaciones y growth para negocios en Colombia y LatAm.',
    features: [
      'apps web/móvil',
      'CRM',
      'automatizaciones',
      'SEO y leads',
      'integraciones DIAN/PSE',
    ],
    brand_voice: 'técnico, cercano, desde Cali',
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
}): Promise<void> {
  const { error } = await withRetry<{ error: unknown }>(() =>
    db.from('content_scripts').insert({
      platform: input.platform,
      topic: input.topic,
      hook: input.hook ?? null,
      script_body: input.script_body,
      seo_copy: input.seo_copy ?? null,
      hashtags: input.hashtags ?? [],
      status: 'draft',
      metadata: input.metadata ?? {},
    }),
  );
  if (error) throw new Error(`insertContentScript: ${errMsg(error)}`);
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

