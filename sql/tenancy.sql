-- SaaS Fase 1 — tenancy (orgs + projects) + columnas en tablas existentes
-- Aplicar con: npm run migrate (ensureSchema carga schema.sql + tenancy.sql)

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'company',
  brand_name VARCHAR(300),
  is_active BOOLEAN NOT NULL DEFAULT true,
  autopilot_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active, autopilot_enabled);

CREATE TABLE IF NOT EXISTS project_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key VARCHAR(120) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_project_settings_project ON project_settings(project_id);

CREATE TABLE IF NOT EXISTS project_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key VARCHAR(120) NOT NULL,
  encrypted_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_project_secrets_project ON project_secrets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_secrets_lookup ON project_secrets(key);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Tenant columns on existing business tables (nullable until backfill)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_id);
CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);

ALTER TABLE growth_interactions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE growth_interactions ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_growth_interactions_project ON growth_interactions(project_id);

ALTER TABLE agent_credentials ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE agent_credentials ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_agent_credentials_project ON agent_credentials(project_id);

ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_content_scripts_project ON content_scripts(project_id);

ALTER TABLE content_briefs ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE content_briefs ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_content_briefs_project ON content_briefs(project_id);

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_blog_posts_project ON blog_posts(project_id);

ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_agent_runs_project ON agent_runs(project_id);

ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_forum_threads_project ON forum_threads(project_id);

ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_forum_posts_project ON forum_posts(project_id);

ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_wa_conversations_project ON whatsapp_conversations(project_id);

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_wa_messages_project ON whatsapp_messages(project_id);

ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_project ON whatsapp_campaigns(project_id);

ALTER TABLE whatsapp_campaign_targets ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE whatsapp_campaign_targets ADD COLUMN IF NOT EXISTS project_id UUID;

ALTER TABLE agent_chat_messages ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE agent_chat_messages ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_agent_chat_project ON agent_chat_messages(project_id);

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_opportunities_project ON opportunities(project_id);

ALTER TABLE app_connections ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE app_connections ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_app_connections_project ON app_connections(project_id);

ALTER TABLE site_knowledge ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE site_knowledge ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_site_knowledge_project ON site_knowledge(project_id);

ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_bot_settings_project ON bot_settings(project_id);

-- Per-project agent enablement (catalog stays global in agent_definitions)
CREATE TABLE IF NOT EXISTS project_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id VARCHAR(50) NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  autopilot_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_project_agents_project ON project_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_agents_enabled ON project_agents(project_id, is_enabled, autopilot_enabled);

-- Feature flags + brand onboarding
ALTER TABLE projects ADD COLUMN IF NOT EXISTS content_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brand_configured BOOLEAN NOT NULL DEFAULT false;

-- Custom / dynamic agents (per project, beyond static catalog)
CREATE TABLE IF NOT EXISTS custom_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  system_prompt TEXT,
  schedule_hint VARCHAR(120),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  autopilot_enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_run_status VARCHAR(40),
  last_run_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_agents_project ON custom_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_custom_agents_enabled ON custom_agents(project_id, is_enabled);

-- Multi-tenant notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(60) NOT NULL DEFAULT 'info',
  title VARCHAR(300) NOT NULL,
  body TEXT,
  link VARCHAR(500),
  is_read BOOLEAN NOT NULL DEFAULT false,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_project_unread ON notifications(project_id, is_read, created_at DESC);

-- Company AI chat messages (project-scoped, separate from agent chat)
CREATE TABLE IF NOT EXISTS company_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_chat_session ON company_chat_messages(project_id, session_id, created_at);
