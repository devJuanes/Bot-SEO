import { useCallback, useEffect, useState } from 'react';
import { projectApi } from '../api/client';

interface SettingsData {
  project?: { name: string; autopilot_enabled?: boolean };
  settings?: Record<string, unknown>;
  secretsConfigured?: Record<string, boolean>;
}

function statusBadge(configured: boolean) {
  return configured ? (
    <span className="config-status ok">● Configurado</span>
  ) : (
    <span className="config-status missing">○ No configurado</span>
  );
}

export function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    autopilot_enabled: false,
    llm_provider: 'minimax',
    llm_model: '',
    llm_base_url: '',
    whatsapp_enabled: false,
    whatsapp_cta_url: '',
    whatsapp_handoff_keywords: '',
    facebook_enabled: false,
    facebook_dry_run: true,
    facebook_auto_publish: false,
  });

  const load = useCallback(async () => {
    const res = await projectApi('/settings');
    const json = (await res.json()) as SettingsData;
    setData(json);
    const s = json.settings || {};
    setForm({
      autopilot_enabled: Boolean(json.project?.autopilot_enabled),
      llm_provider: String(s.llm_provider || 'minimax'),
      llm_model: String(s.llm_model || ''),
      llm_base_url: String(s.llm_base_url || ''),
      whatsapp_enabled: Boolean(s.whatsapp_enabled),
      whatsapp_cta_url: String(s.whatsapp_cta_url || ''),
      whatsapp_handoff_keywords: String(s.whatsapp_handoff_keywords || ''),
      facebook_enabled: Boolean(s.facebook_enabled),
      facebook_dry_run: s.facebook_dry_run !== false,
      facebook_auto_publish: Boolean(s.facebook_auto_publish),
    });
    setSecrets({});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setSecret(key: string, value: string) {
    setSecrets((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const settings = {
        llm_provider: form.llm_provider,
        llm_model: form.llm_model.trim(),
        llm_base_url: form.llm_base_url.trim(),
        whatsapp_enabled: form.whatsapp_enabled,
        whatsapp_cta_url: form.whatsapp_cta_url.trim(),
        whatsapp_handoff_keywords: form.whatsapp_handoff_keywords.trim(),
        facebook_enabled: form.facebook_enabled,
        facebook_dry_run: form.facebook_dry_run,
        facebook_auto_publish: form.facebook_auto_publish,
      };

      const secretPayload: Record<string, string> = {};
      for (const [k, v] of Object.entries(secrets)) {
        if (v.trim()) secretPayload[k] = v.trim();
      }

      await projectApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings, secrets: secretPayload }),
      });

      await projectApi('', {
        method: 'PATCH',
        body: JSON.stringify({ autopilot_enabled: form.autopilot_enabled }),
      });

      setToast('Configuración guardada');
      setTimeout(() => setToast(''), 3000);
      await load();
    } catch {
      setToast('Error al guardar');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSaving(false);
    }
  }

  const sc = data?.secretsConfigured || {};

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="page-title">Ajustes del proyecto</h1>
          <p className="page-subtitle">
            {data?.project?.name
              ? `Proyecto: ${data.project.name}`
              : 'Configura integraciones y credenciales'}
          </p>
        </div>
        <div className="topbar-right">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </header>

      <main className="content-area settings-grid">
        <section className="panel settings-section">
          <div className="panel-header">
            <div>
              <h2>Proyecto</h2>
              <p className="panel-desc">Configuración general y autopilot</p>
            </div>
          </div>
          <label className="field-check">
            <input
              type="checkbox"
              checked={form.autopilot_enabled}
              onChange={(e) => setForm((f) => ({ ...f, autopilot_enabled: e.target.checked }))}
            />
            <span>Autopilot habilitado para este proyecto</span>
          </label>
        </section>

        <section className="panel settings-section">
          <div className="panel-header">
            <div>
              <h2>
                LLM {statusBadge(Boolean(sc.llm_api_key && form.llm_model && form.llm_base_url))}
              </h2>
              <p className="panel-desc">Proveedor de inteligencia artificial para agentes</p>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="llm_provider">Proveedor</label>
              <select
                id="llm_provider"
                value={form.llm_provider}
                onChange={(e) => setForm((f) => ({ ...f, llm_provider: e.target.value }))}
              >
                <option value="minimax">MiniMax</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="llm_model">Modelo</label>
              <input
                id="llm_model"
                value={form.llm_model}
                onChange={(e) => setForm((f) => ({ ...f, llm_model: e.target.value }))}
                placeholder="MiniMax-M2.1"
              />
            </div>
            <div className="form-field full">
              <label htmlFor="llm_base_url">Base URL</label>
              <input
                id="llm_base_url"
                type="url"
                value={form.llm_base_url}
                onChange={(e) => setForm((f) => ({ ...f, llm_base_url: e.target.value }))}
                placeholder="https://api.minimax.io/v1"
              />
            </div>
            <div className="form-field full">
              <label htmlFor="llm_api_key">
                API Key {sc.llm_api_key ? '(guardada)' : ''}
              </label>
              <input
                id="llm_api_key"
                type="password"
                placeholder={sc.llm_api_key ? '••••••••' : 'Pega tu API key'}
                onChange={(e) => setSecret('llm_api_key', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="panel settings-section">
          <div className="panel-header">
            <div>
              <h2>
                WhatsApp{' '}
                {statusBadge(
                  Boolean(sc.whatsapp_access_token && sc.whatsapp_phone_number_id),
                )}
              </h2>
              <p className="panel-desc">Cloud API de Meta para mensajería</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-check full">
              <input
                type="checkbox"
                checked={form.whatsapp_enabled}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_enabled: e.target.checked }))}
              />
              <span>WhatsApp habilitado</span>
            </label>
            <div className="form-field">
              <label htmlFor="whatsapp_phone_number_id">Phone Number ID</label>
              <input
                id="whatsapp_phone_number_id"
                placeholder={sc.whatsapp_phone_number_id ? '••••' : ''}
                onChange={(e) => setSecret('whatsapp_phone_number_id', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="whatsapp_business_account_id">Business Account ID</label>
              <input
                id="whatsapp_business_account_id"
                placeholder={sc.whatsapp_business_account_id ? '••••' : ''}
                onChange={(e) => setSecret('whatsapp_business_account_id', e.target.value)}
              />
            </div>
            <div className="form-field full">
              <label htmlFor="whatsapp_access_token">Access Token</label>
              <input
                id="whatsapp_access_token"
                type="password"
                placeholder={sc.whatsapp_access_token ? '••••••••' : ''}
                onChange={(e) => setSecret('whatsapp_access_token', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="whatsapp_verify_token">Verify Token (webhook)</label>
              <input
                id="whatsapp_verify_token"
                type="password"
                placeholder={sc.whatsapp_verify_token ? '••••' : ''}
                onChange={(e) => setSecret('whatsapp_verify_token', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="whatsapp_owner_phone">Teléfono del dueño</label>
              <input
                id="whatsapp_owner_phone"
                placeholder={sc.whatsapp_owner_phone ? '••••' : ''}
                onChange={(e) => setSecret('whatsapp_owner_phone', e.target.value)}
              />
            </div>
            <div className="form-field full">
              <label htmlFor="whatsapp_cta_url">URL CTA</label>
              <input
                id="whatsapp_cta_url"
                type="url"
                value={form.whatsapp_cta_url}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_cta_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="form-field full">
              <label htmlFor="whatsapp_handoff_keywords">Palabras de handoff (coma)</label>
              <input
                id="whatsapp_handoff_keywords"
                value={form.whatsapp_handoff_keywords}
                onChange={(e) =>
                  setForm((f) => ({ ...f, whatsapp_handoff_keywords: e.target.value }))
                }
              />
            </div>
          </div>
        </section>

        <section className="panel settings-section">
          <div className="panel-header">
            <div>
              <h2>
                Facebook{' '}
                {statusBadge(Boolean(sc.facebook_page_access_token && sc.facebook_page_id))}
              </h2>
              <p className="panel-desc">Publicación automática en página de Facebook</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-check">
              <input
                type="checkbox"
                checked={form.facebook_enabled}
                onChange={(e) => setForm((f) => ({ ...f, facebook_enabled: e.target.checked }))}
              />
              <span>Facebook habilitado</span>
            </label>
            <label className="field-check">
              <input
                type="checkbox"
                checked={form.facebook_dry_run}
                onChange={(e) => setForm((f) => ({ ...f, facebook_dry_run: e.target.checked }))}
              />
              <span>Modo dry-run (no publica de verdad)</span>
            </label>
            <label className="field-check full">
              <input
                type="checkbox"
                checked={form.facebook_auto_publish}
                onChange={(e) =>
                  setForm((f) => ({ ...f, facebook_auto_publish: e.target.checked }))
                }
              />
              <span>Auto-publicar cuando el agente genera contenido</span>
            </label>
            <div className="form-field">
              <label htmlFor="facebook_page_id">Page ID</label>
              <input
                id="facebook_page_id"
                placeholder={sc.facebook_page_id ? '••••' : ''}
                onChange={(e) => setSecret('facebook_page_id', e.target.value)}
              />
            </div>
            <div className="form-field full">
              <label htmlFor="facebook_page_access_token">Page Access Token</label>
              <input
                id="facebook_page_access_token"
                type="password"
                placeholder={sc.facebook_page_access_token ? '••••••••' : ''}
                onChange={(e) => setSecret('facebook_page_access_token', e.target.value)}
              />
            </div>
          </div>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
