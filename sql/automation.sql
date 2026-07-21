-- Automation rules & lead pipeline events

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  organization_id UUID,
  name VARCHAR(200) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  last_run_at TIMESTAMPTZ,
  run_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_project ON automation_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(project_id, trigger_type, is_enabled);

CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL,
  project_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  trigger_payload JSONB DEFAULT '{}',
  actions_result JSONB DEFAULT '[]',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON automation_runs(rule_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  project_id UUID NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by VARCHAR(100),
  reason TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_status_events_lead ON lead_status_events(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_status_events_project ON lead_status_events(project_id, created_at DESC);
