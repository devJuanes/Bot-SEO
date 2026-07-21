import { useCallback, useEffect, useState } from 'react';
import { api, apiJson } from '../api/client';

interface Conversation {
  id: string;
  profile_name?: string;
  wa_id: string;
  mode: string;
  unread_count: number;
  last_message_at?: string;
}

interface Campaign {
  id: string;
  name: string;
  template_name: string;
  template_language: string;
  status: string;
  sent_count: number;
  total_targets: number;
  failed_count: number;
}

interface Template {
  name: string;
  language: string;
  status: string;
}

function timeAgo(iso?: string): string {
  if (!iso) return '--';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

export function WhatsAppPage() {
  const [configured, setConfigured] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesError, setTemplatesError] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCampaignForm, setShowCampaignForm] = useState(false);

  const refresh = useCallback(async () => {
    const status = await apiJson<{ configured: boolean }>('/api/whatsapp/status');
    setConfigured(status.configured);

    try {
      const tpl = await apiJson<{ templates: Template[] }>('/api/whatsapp/templates');
      setTemplates(tpl.templates || []);
      setTemplatesError('');
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : String(err));
    }

    const conv = await apiJson<{ conversations: Conversation[] }>('/api/whatsapp/conversations');
    setConversations(conv.conversations || []);

    const camp = await apiJson<{ campaigns: Campaign[] }>('/api/whatsapp/campaigns');
    setCampaigns(camp.campaigns || []);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 10000);
    return () => clearInterval(t);
  }, [refresh]);

  async function handleTestSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const bodyParams = String(form.get('bodyParams') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      to: form.get('to'),
      templateName: form.get('templateName'),
      templateLanguage: form.get('templateLanguage') || 'es',
      bodyParams,
    };
    const res = await api('/api/whatsapp/templates/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((data as { error?: string }).error || `Error ${res.status}`);
      return;
    }
    alert(
      `Prueba enviada a ${payload.to}\nwaMessageId: ${(data as { waMessageId?: string }).waMessageId || 'ok'}\nRevisa WhatsApp.`,
    );
    await refresh();
  }

  async function handleCampaignSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const bodyParams = String(form.get('bodyParams') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const leadFilter: Record<string, string> = {};
    const sector = String(form.get('sector') || '').trim();
    const city = String(form.get('city') || '').trim();
    if (sector) leadFilter.sector = sector;
    if (city) leadFilter.city = city;
    const lang = String(form.get('templateLanguage') || 'es').trim() || 'es';

    if (
      !confirm(
        'Esto enviará a TODOS los leads filtrados.\n¿Ya probaste con ENVIAR PRUEBA a tu número?',
      )
    ) {
      return;
    }

    const res = await api('/api/whatsapp/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        templateName: form.get('templateName'),
        templateLanguage: lang,
        appSlug: form.get('appSlug') || undefined,
        bodyParamsTemplate: bodyParams,
        leadFilter,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((data as { error?: string }).error || `Error al crear la campaña (${res.status})`);
      return;
    }
    alert(`Campaña lanzada: ${(data as { totalTargets?: number }).totalTargets} destinatarios\nIdioma: ${lang}`);
    setShowCampaignForm(false);
    e.currentTarget.reset();
    await refresh();
  }

  async function showFailures(campaignId: string, campaignName: string) {
    try {
      const data = await apiJson<{ failures: Array<{ wa_id: string; error?: string }> }>(
        `/api/whatsapp/campaigns/${encodeURIComponent(campaignId)}/failures`,
      );
      const failures = data.failures || [];
      if (failures.length === 0) {
        alert(`${campaignName}\nSin detalle de errores guardado.`);
        return;
      }
      const lines = failures.map((f) => `• ${f.wa_id}: ${f.error || 'sin mensaje'}`).join('\n');
      alert(`Errores de "${campaignName}" (muestra):\n\n${lines}`);
    } catch (err) {
      alert(`No se pudieron cargar errores: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function cancelCampaign(id: string) {
    await api(`/api/whatsapp/campaigns/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    await refresh();
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="page-title">WhatsApp</h1>
          <p className="page-subtitle">Inbox, campañas y plantillas</p>
        </div>
        <div className="topbar-right">
          <span className={`status-badge${configured ? ' on' : ' off'}`}>
            {configured ? 'Meta: conectado' : 'Meta: sin configurar'}
          </span>
          <a className="btn btn-secondary btn-sm" href="/wa.html">
            WhatsApp Web
          </a>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowCampaignForm((v) => !v)}
          >
            Nueva campaña
          </button>
        </div>
      </header>

      <main className="content-area">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Prueba 1 número</h2>
              <p className="panel-desc">Antes de lanzar campañas masivas</p>
            </div>
          </div>
          <form className="form-stack" onSubmit={handleTestSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="test-to">WhatsApp con país</label>
                <input id="test-to" name="to" defaultValue="573023580862" required />
              </div>
              <div className="form-field">
                <label htmlFor="test-template">Plantilla Meta</label>
                <input id="test-template" name="templateName" defaultValue="contacto_cliente" required />
              </div>
              <div className="form-field">
                <label htmlFor="test-lang">Idioma</label>
                <input id="test-lang" name="templateLanguage" defaultValue="es" />
              </div>
              <div className="form-field">
                <label htmlFor="test-params">Params (coma)</label>
                <input id="test-params" name="bodyParams" defaultValue="Juan" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Enviar prueba
            </button>
          </form>
          <p className="hint">
            {templatesError ||
              (templates.length
                ? `Plantillas: ${templates.map((t) => `${t.name}/${t.language} (${t.status})`).join(' · ')}`
                : 'Cargando plantillas…')}
          </p>
        </section>

        {showCampaignForm && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Campaña masiva</h2>
                <p className="panel-desc">Solo si la prueba funcionó</p>
              </div>
            </div>
            <form className="form-stack" onSubmit={handleCampaignSubmit}>
              <div className="form-grid">
                <div className="form-field full">
                  <label htmlFor="camp-name">Nombre</label>
                  <input id="camp-name" name="name" required />
                </div>
                <div className="form-field">
                  <label htmlFor="camp-template">Plantilla</label>
                  <input id="camp-template" name="templateName" defaultValue="contacto_cliente" required />
                </div>
                <div className="form-field">
                  <label htmlFor="camp-lang">Idioma</label>
                  <input id="camp-lang" name="templateLanguage" defaultValue="es" />
                </div>
                <div className="form-field">
                  <label htmlFor="camp-app">App slug (opcional)</label>
                  <input id="camp-app" name="appSlug" placeholder="matucrm" />
                </div>
                <div className="form-field">
                  <label htmlFor="camp-params">Params</label>
                  <input id="camp-params" name="bodyParams" defaultValue="{{name}}" />
                </div>
                <div className="form-field">
                  <label htmlFor="camp-sector">Sector (filtro)</label>
                  <input id="camp-sector" name="sector" placeholder="peluquerias" />
                </div>
                <div className="form-field">
                  <label htmlFor="camp-city">Ciudad (filtro)</label>
                  <input id="camp-city" name="city" placeholder="Cali" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Lanzar campaña masiva
              </button>
            </form>
            <p className="hint">
              Solo usa plantillas <strong>APPROVED</strong>. No lances masivo hasta que la prueba llegue.
            </p>
          </section>
        )}

        <section className="grid-2">
          <div className="panel">
            <div className="panel-header"><h2>Conversaciones</h2></div>
            <div className="data-table wa-list">
              {conversations.length === 0 ? (
                <div className="data-row muted">
                  Sin conversaciones aún. Escribe al número de WhatsApp Business para probar.
                </div>
              ) : (
                conversations.map((c) => (
                  <a
                    key={c.id}
                    href={`/wa.html?id=${encodeURIComponent(c.id)}`}
                    className="data-row wa-row"
                  >
                    <span className="data-primary">
                      {c.profile_name || c.wa_id}
                      {c.unread_count > 0 && <span className="tag tag-success">{c.unread_count}</span>}
                    </span>
                    <span>{c.wa_id}</span>
                    <span>
                      <span className={`tag${c.mode === 'human' ? ' tag-warn' : ''}`}>
                        {c.mode.toUpperCase()}
                      </span>
                    </span>
                    <span>{timeAgo(c.last_message_at)}</span>
                  </a>
                ))
              )}
            </div>
          </div>
          <div className="panel">
            <div className="panel-header"><h2>Campañas</h2></div>
            <div className="data-table wa-list">
              {campaigns.length === 0 ? (
                <div className="data-row muted">Sin campañas todavía.</div>
              ) : (
                campaigns.map((c) => (
                  <div key={c.id} className="data-row wa-campaign">
                    <button
                      type="button"
                      className="wa-campaign-btn"
                      onClick={() => void showFailures(c.id, c.name)}
                    >
                      <span className="data-primary">{c.name}</span>
                      <span>
                        {c.template_name} · lang {c.template_language}
                      </span>
                      <span>
                        <span className="tag">{c.status}</span>
                      </span>
                      <span>
                        {c.sent_count}/{c.total_targets} · fail {c.failed_count}
                      </span>
                    </button>
                    {c.status === 'sending' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void cancelCampaign(c.id)}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
