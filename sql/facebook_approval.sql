-- ═══════════════════════════════════════════════════════════════════════
-- MatuByte Bot SEO — Facebook approval queue + bot_settings
-- Ejecutar en MatuDB / Postgres (también se aplica con npm run migrate
-- si está incluido en sql/schema.sql).
-- ═══════════════════════════════════════════════════════════════════════

-- Preferencias de bots (auto vs manual, etc.)
CREATE TABLE IF NOT EXISTS bot_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO bot_settings (key, value)
VALUES (
  'facebook_publisher',
  jsonb_build_object(
    'mode', 'manual',
    'auto_publish', false,
    'default_hashtags', jsonb_build_array('#MatuByte', '#Software', '#Colombia'),
    'notes', 'manual = requiere Aprobar en /facebook.html; auto = publica al generar'
  )
)
ON CONFLICT (key) DO NOTHING;

-- Extra tracking para cola de aprobación
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS approved_by VARCHAR(80);
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS seo_title VARCHAR(200);
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];

-- publish_status permitidos:
--   draft          → borrador interno
--   pending_review → esperando tu OK en el panel
--   approved       → aprobado, listo/en camino a publicar
--   published      → vivo en Facebook
--   failed         → error Graph API
--   skipped        → rechazado / descartado

CREATE INDEX IF NOT EXISTS idx_content_scripts_pending_fb
  ON content_scripts (platform, publish_status, created_at DESC)
  WHERE platform = 'facebook';

COMMENT ON TABLE bot_settings IS 'Config runtime de agentes (facebook mode auto|manual, etc.)';
COMMENT ON COLUMN content_scripts.publish_status IS
  'draft|pending_review|approved|published|failed|skipped';
