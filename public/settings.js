const formEl = document.getElementById('settingsForm');
const saveBtn = document.getElementById('saveBtn');

let secretsConfigured = {};

function projectId() {
  return window.GrowthAuth?.getProjectId?.();
}

function statusBadge(configured) {
  return configured
    ? '<span class="config-status ok">● Configurado</span>'
    : '<span class="config-status missing">○ No configurado</span>';
}

function renderForm(data) {
  const s = data.settings || {};
  secretsConfigured = data.secretsConfigured || {};
  const subtitle = document.getElementById('projectSubtitle');
  if (subtitle && data.project) {
    subtitle.textContent = `Proyecto: ${data.project.name}`;
  }

  formEl.innerHTML = `
    <section class="panel settings-section">
      <div class="panel-header">
        <div>
          <h2>Proyecto</h2>
          <p>Configuración general y autopilot</p>
        </div>
      </div>
      <div class="form-grid">
        <label class="field-check full">
          <input type="checkbox" id="autopilot_enabled" ${data.project?.autopilot_enabled ? 'checked' : ''} />
          <span>Autopilot habilitado para este proyecto</span>
        </label>
      </div>
    </section>

    <section class="panel settings-section">
      <div class="panel-header">
        <div>
          <h2>LLM ${statusBadge(secretsConfigured.llm_api_key && s.llm_model && s.llm_base_url)}</h2>
          <p>Proveedor de inteligencia artificial para agentes</p>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-field">
          <label for="llm_provider">Proveedor</label>
          <select id="llm_provider">
            <option value="minimax" ${s.llm_provider === 'minimax' || !s.llm_provider ? 'selected' : ''}>MiniMax</option>
          </select>
        </div>
        <div class="form-field">
          <label for="llm_model">Modelo</label>
          <input id="llm_model" type="text" value="${s.llm_model || ''}" placeholder="MiniMax-M2.1" />
        </div>
        <div class="form-field full">
          <label for="llm_base_url">Base URL</label>
          <input id="llm_base_url" type="url" value="${s.llm_base_url || ''}" placeholder="https://api.minimax.io/v1" />
        </div>
        <div class="form-field full">
          <label for="llm_api_key">API Key ${secretsConfigured.llm_api_key ? '(guardada)' : ''}</label>
          <input id="llm_api_key" type="password" placeholder="${secretsConfigured.llm_api_key ? '••••••••' : 'Pega tu API key'}" />
        </div>
      </div>
    </section>

    <section class="panel settings-section">
      <div class="panel-header">
        <div>
          <h2>WhatsApp ${statusBadge(secretsConfigured.whatsapp_access_token && secretsConfigured.whatsapp_phone_number_id)}</h2>
          <p>Cloud API de Meta para mensajería</p>
        </div>
      </div>
      <div class="form-grid">
        <label class="field-check full">
          <input type="checkbox" id="whatsapp_enabled" ${s.whatsapp_enabled ? 'checked' : ''} />
          <span>WhatsApp habilitado</span>
        </label>
        <div class="form-field">
          <label for="whatsapp_phone_number_id">Phone Number ID</label>
          <input id="whatsapp_phone_number_id" type="text" placeholder="${secretsConfigured.whatsapp_phone_number_id ? '••••' : ''}" />
        </div>
        <div class="form-field">
          <label for="whatsapp_business_account_id">Business Account ID</label>
          <input id="whatsapp_business_account_id" type="text" placeholder="${secretsConfigured.whatsapp_business_account_id ? '••••' : ''}" />
        </div>
        <div class="form-field full">
          <label for="whatsapp_access_token">Access Token</label>
          <input id="whatsapp_access_token" type="password" placeholder="${secretsConfigured.whatsapp_access_token ? '••••••••' : ''}" />
        </div>
        <div class="form-field">
          <label for="whatsapp_verify_token">Verify Token (webhook)</label>
          <input id="whatsapp_verify_token" type="password" placeholder="${secretsConfigured.whatsapp_verify_token ? '••••' : ''}" />
        </div>
        <div class="form-field">
          <label for="whatsapp_owner_phone">Teléfono del dueño</label>
          <input id="whatsapp_owner_phone" type="text" placeholder="${secretsConfigured.whatsapp_owner_phone ? '••••' : ''}" />
        </div>
        <div class="form-field full">
          <label for="whatsapp_cta_url">URL CTA</label>
          <input id="whatsapp_cta_url" type="url" value="${s.whatsapp_cta_url || ''}" placeholder="https://..." />
        </div>
        <div class="form-field full">
          <label for="whatsapp_handoff_keywords">Palabras de handoff (separadas por coma)</label>
          <input id="whatsapp_handoff_keywords" type="text" value="${s.whatsapp_handoff_keywords || ''}" />
        </div>
      </div>
    </section>

    <section class="panel settings-section">
      <div class="panel-header">
        <div>
          <h2>Facebook ${statusBadge(secretsConfigured.facebook_page_access_token && secretsConfigured.facebook_page_id)}</h2>
          <p>Publicación automática en página de Facebook</p>
        </div>
      </div>
      <div class="form-grid">
        <label class="field-check">
          <input type="checkbox" id="facebook_enabled" ${s.facebook_enabled ? 'checked' : ''} />
          <span>Facebook habilitado</span>
        </label>
        <label class="field-check">
          <input type="checkbox" id="facebook_dry_run" ${s.facebook_dry_run !== false ? 'checked' : ''} />
          <span>Modo dry-run (no publica de verdad)</span>
        </label>
        <label class="field-check full">
          <input type="checkbox" id="facebook_auto_publish" ${s.facebook_auto_publish ? 'checked' : ''} />
          <span>Auto-publicar cuando el agente genera contenido</span>
        </label>
        <div class="form-field">
          <label for="facebook_page_id">Page ID</label>
          <input id="facebook_page_id" type="text" placeholder="${secretsConfigured.facebook_page_id ? '••••' : ''}" />
        </div>
        <div class="form-field full">
          <label for="facebook_page_access_token">Page Access Token</label>
          <input id="facebook_page_access_token" type="password" placeholder="${secretsConfigured.facebook_page_access_token ? '••••••••' : ''}" />
        </div>
      </div>
    </section>
  `;
}

async function loadSettings() {
  const pid = projectId();
  const res = await GrowthAuth.api(`/api/projects/${pid}/settings`);
  const data = await res.json();
  renderForm(data);
}

function collectPayload() {
  const settings = {
    llm_provider: document.getElementById('llm_provider')?.value || 'minimax',
    llm_model: document.getElementById('llm_model')?.value?.trim() || '',
    llm_base_url: document.getElementById('llm_base_url')?.value?.trim() || '',
    whatsapp_enabled: document.getElementById('whatsapp_enabled')?.checked ?? false,
    whatsapp_cta_url: document.getElementById('whatsapp_cta_url')?.value?.trim() || '',
    whatsapp_handoff_keywords:
      document.getElementById('whatsapp_handoff_keywords')?.value?.trim() || '',
    facebook_enabled: document.getElementById('facebook_enabled')?.checked ?? false,
    facebook_dry_run: document.getElementById('facebook_dry_run')?.checked ?? true,
    facebook_auto_publish: document.getElementById('facebook_auto_publish')?.checked ?? false,
  };

  const secrets = {};
  const secretFields = [
    ['llm_api_key', 'llm_api_key'],
    ['whatsapp_access_token', 'whatsapp_access_token'],
    ['whatsapp_phone_number_id', 'whatsapp_phone_number_id'],
    ['whatsapp_business_account_id', 'whatsapp_business_account_id'],
    ['whatsapp_verify_token', 'whatsapp_verify_token'],
    ['whatsapp_owner_phone', 'whatsapp_owner_phone'],
    ['facebook_page_access_token', 'facebook_page_access_token'],
    ['facebook_page_id', 'facebook_page_id'],
  ];

  for (const [id, key] of secretFields) {
    const val = document.getElementById(id)?.value?.trim();
    if (val) secrets[key] = val;
  }

  return { settings, secrets };
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function saveSettings() {
  saveBtn.disabled = true;
  try {
    const pid = projectId();
    const { settings, secrets } = collectPayload();

    await GrowthAuth.api(`/api/projects/${pid}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ settings, secrets }),
    });

    const autopilot = document.getElementById('autopilot_enabled')?.checked ?? false;
    await GrowthAuth.api(`/api/projects/${pid}`, {
      method: 'PATCH',
      body: JSON.stringify({ autopilot_enabled: autopilot }),
    });

    showToast('Configuración guardada');
    await loadSettings();
  } catch {
    showToast('Error al guardar');
  } finally {
    saveBtn.disabled = false;
  }
}

saveBtn?.addEventListener('click', () => void saveSettings());
await loadSettings();
