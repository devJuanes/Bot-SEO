-- MatuByte Growth Factory — schema MatuDB (PostgreSQL)
-- Aplicar con: npm run migrate

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255),
  source VARCHAR(50) NOT NULL DEFAULT 'google_maps',
  name VARCHAR(500) NOT NULL,
  business_type VARCHAR(200),
  description TEXT,
  country VARCHAR(10) DEFAULT 'CO',
  city VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website TEXT,
  needs_website BOOLEAN NOT NULL DEFAULT false,
  google_maps_url TEXT,
  google_rating DECIMAL(3,2),
  google_reviews_count INT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  score INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_needs_website ON leads(needs_website);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

CREATE TABLE IF NOT EXISTS growth_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(50) NOT NULL,
  external_thread_id VARCHAR(255),
  thread_url TEXT,
  thread_title TEXT,
  thread_snippet TEXT,
  response_content TEXT,
  cta_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  agent_id VARCHAR(50) NOT NULL DEFAULT 'infiltrator',
  metadata JSONB DEFAULT '{}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_growth_interactions_platform ON growth_interactions(platform);
CREATE INDEX IF NOT EXISTS idx_growth_interactions_status ON growth_interactions(status);

CREATE TABLE IF NOT EXISTS agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(50) NOT NULL UNIQUE,
  username VARCHAR(255),
  secret_ref TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(50) NOT NULL,
  topic VARCHAR(500) NOT NULL,
  hook TEXT,
  script_body TEXT NOT NULL,
  seo_copy TEXT,
  hashtags TEXT[] DEFAULT '{}',
  trend_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_scripts_platform ON content_scripts(platform);
CREATE INDEX IF NOT EXISTS idx_content_scripts_status ON content_scripts(status);

-- Briefs de tendencias/problemas que alimentan al Redactor de Blogs
CREATE TABLE IF NOT EXISTS content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  problem TEXT,
  trend TEXT,
  angle TEXT NOT NULL,
  city VARCHAR(100),
  country VARCHAR(10) DEFAULT 'CO',
  sector VARCHAR(200),
  priority INT DEFAULT 50,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_briefs_status ON content_briefs(status, priority DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  seo_title VARCHAR(500),
  seo_description TEXT,
  seo_keywords TEXT[] DEFAULT '{}',
  locale VARCHAR(10) DEFAULT 'es-CO',
  city VARCHAR(100) DEFAULT 'Cali',
  sector VARCHAR(200),
  cover_image TEXT,
  cover_image_alt VARCHAR(300),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS sector VARCHAR(200);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_image_alt VARCHAR(300);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50) NOT NULL,
  triggered_by VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL,
  reason TEXT,
  details JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);

-- Foro interno MatuByte (visible en matubyte.com/foro). Cualquier visitante puede
-- publicar; el Agente Comunidad también participa como autor tipo 'agent'.
CREATE TABLE IF NOT EXISTS forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  created_by VARCHAR(100) NOT NULL DEFAULT 'community',
  author_name VARCHAR(200) NOT NULL DEFAULT 'Anónimo',
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  views INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_status ON forum_threads(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_created ON forum_threads(created_at DESC);

CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_type VARCHAR(20) NOT NULL DEFAULT 'human',
  author_name VARCHAR(200) NOT NULL DEFAULT 'Anónimo',
  agent_id VARCHAR(50),
  content TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'published',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author_type ON forum_posts(author_type);

-- WhatsApp Cloud API: inbox + handoff bot/humano + campañas salientes.
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id VARCHAR(32) NOT NULL UNIQUE,
  profile_name VARCHAR(200),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  mode VARCHAR(20) NOT NULL DEFAULT 'bot',
  assigned_to VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ,
  last_customer_message_at TIMESTAMPTZ,
  unread_count INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_mode ON whatsapp_conversations(mode, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_status ON whatsapp_conversations(status);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id VARCHAR(150),
  direction VARCHAR(10) NOT NULL,
  sender_type VARCHAR(20) NOT NULL DEFAULT 'customer',
  content TEXT NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  template_name VARCHAR(150),
  status VARCHAR(20) DEFAULT 'sent',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON whatsapp_messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  template_name VARCHAR(150) NOT NULL,
  template_language VARCHAR(10) NOT NULL DEFAULT 'es',
  app_slug VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_targets INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_by VARCHAR(100) DEFAULT 'manual',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  wa_id VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_targets_campaign ON whatsapp_campaign_targets(campaign_id);

-- Phase 4: agent catalog in DB
CREATE TABLE IF NOT EXISTS agent_definitions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  role VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  capabilities TEXT[] DEFAULT '{}',
  system_prompt TEXT,
  is_chat_enabled BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_chat_agent_session ON agent_chat_messages(agent_id, session_id, created_at);

-- Opportunities beyond Maps: jobs, gov, forums
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255),
  source VARCHAR(50) NOT NULL,
  opportunity_type VARCHAR(40) NOT NULL,
  title VARCHAR(700) NOT NULL,
  company_name VARCHAR(500),
  description TEXT,
  city VARCHAR(100),
  country VARCHAR(10) DEFAULT 'CO',
  source_url TEXT,
  contact_hint TEXT,
  needs_software BOOLEAN NOT NULL DEFAULT true,
  score INT DEFAULT 50,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  tags TEXT[] DEFAULT '{}',
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_created ON opportunities(created_at DESC);

-- App / product tokens that feed the social content creator
CREATE TABLE IF NOT EXISTS app_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  platform VARCHAR(50) NOT NULL DEFAULT 'custom',
  app_url TEXT,
  access_token TEXT,
  description TEXT,
  features JSONB DEFAULT '[]',
  brand_voice TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_connections_active ON app_connections(is_active);

-- Editable site/company knowledge for blogs & content
CREATE TABLE IF NOT EXISTS site_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Facebook Publisher: tracking de publicación en página de Facebook (Meta Graph API)
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS fb_post_id VARCHAR(100);
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS fb_permalink_url TEXT;
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS fb_published_at TIMESTAMPTZ;
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS fb_photo_url TEXT;
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS publish_status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS trend_source VARCHAR(50);
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS trend_url TEXT;

CREATE INDEX IF NOT EXISTS idx_content_scripts_publish_status
  ON content_scripts(publish_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_scripts_platform_published
  ON content_scripts(platform, fb_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_scripts_trend_url
  ON content_scripts(trend_url);
