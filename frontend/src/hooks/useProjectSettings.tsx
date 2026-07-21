import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { projectApi } from '../api/client';

export interface SettingsForm {
  autopilot_enabled: boolean;
  llm_provider: string;
  llm_model: string;
  llm_base_url: string;
  whatsapp_enabled: boolean;
  whatsapp_cta_url: string;
  whatsapp_handoff_keywords: string;
  facebook_enabled: boolean;
  facebook_dry_run: boolean;
  facebook_auto_publish: boolean;
  facebook_custom_prompt: string;
  brand_name: string;
  brand_knowledge: string;
}

interface SettingsData {
  project?: { name: string; autopilot_enabled?: boolean };
  settings?: Record<string, unknown>;
  secretsConfigured?: Record<string, boolean>;
}

interface SettingsContextValue {
  data: SettingsData | null;
  form: SettingsForm;
  setForm: React.Dispatch<React.SetStateAction<SettingsForm>>;
  secrets: Record<string, string>;
  setSecret: (key: string, value: string) => void;
  saving: boolean;
  toast: string;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  sc: Record<string, boolean>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const defaultForm: SettingsForm = {
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
  facebook_custom_prompt: '',
  brand_name: '',
  brand_knowledge: '',
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const reload = useCallback(async () => {
    const res = await projectApi('/settings');
    if (!res.ok) return;
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
      facebook_custom_prompt: String(s.facebook_custom_prompt || ''),
      brand_name: String(s.brand_name || ''),
      brand_knowledge: String(s.brand_knowledge || ''),
    });
    setSecrets({});
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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
        facebook_custom_prompt: form.facebook_custom_prompt.trim(),
        brand_name: form.brand_name.trim(),
        brand_knowledge: form.brand_knowledge.trim(),
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
      await reload();
    } catch {
      setToast('Error al guardar');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSaving(false);
    }
  }

  const sc = data?.secretsConfigured || {};

  return (
    <SettingsContext.Provider
      value={{ data, form, setForm, secrets, setSecret, saving, toast, save, reload, sc }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useProjectSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useProjectSettings must be used within SettingsProvider');
  return ctx;
}
