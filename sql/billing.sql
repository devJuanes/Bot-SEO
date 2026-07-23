-- Billing: códigos de invitación, registros pendientes y suscripciones

CREATE TABLE IF NOT EXISTS invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  plan VARCHAR(20) NOT NULL DEFAULT 'vip',
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);

CREATE TABLE IF NOT EXISTS invitation_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_code_id UUID NOT NULL REFERENCES invitation_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitation_code_uses_user ON invitation_code_uses(user_id);

CREATE TABLE IF NOT EXISTS pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  password_enc TEXT NOT NULL,
  name VARCHAR(200) NOT NULL,
  organization_name VARCHAR(300),
  plan_id VARCHAR(40) NOT NULL DEFAULT 'plan-pro',
  payment_reference VARCHAR(120) NOT NULL UNIQUE,
  link_id VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_ref ON pending_signups(payment_reference);
CREATE INDEX IF NOT EXISTS idx_pending_signups_status ON pending_signups(status);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  payment_reference VARCHAR(120),
  amount INT,
  currency VARCHAR(10) DEFAULT 'COP',
  link_id VARCHAR(120),
  transaction_id VARCHAR(120),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  source VARCHAR(30) NOT NULL DEFAULT 'payment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org ON organization_subscriptions(organization_id);

INSERT INTO invitation_codes (code, plan, max_uses, notes) VALUES
  ('MATUBYTE-VIP-2026', 'vip', 100, 'Acceso VIP Growth Factory — MatuByte'),
  ('GROWTH-BETA-001', 'vip', 25, 'Beta testers Growth Factory'),
  ('FOUNDER-ACCESS', 'vip', 10, 'Fundadores y aliados estratégicos')
ON CONFLICT (code) DO NOTHING;
