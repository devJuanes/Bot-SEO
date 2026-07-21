const conversationsList = document.getElementById('conversationsList');
const campaignsList = document.getElementById('campaignsList');
const newCampaignBtn = document.getElementById('newCampaignBtn');
const campaignForm = document.getElementById('campaignForm');
const campaignFormEl = document.getElementById('campaignFormEl');
const testFormEl = document.getElementById('testFormEl');
const templatesHint = document.getElementById('templatesHint');
const waStatusPill = document.getElementById('waStatusPill');

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function timeAgo(iso) {
  if (!iso) return '--';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

async function loadStatus() {
  const res = await fetch('/api/whatsapp/status');
  const data = await res.json();
  waStatusPill.textContent = data.configured ? 'META: CONECTADO' : 'META: SIN CONFIGURAR';
  waStatusPill.classList.toggle('on', data.configured);
}

async function loadTemplates() {
  try {
    const res = await fetch('/api/whatsapp/templates');
    const data = await res.json();
    if (!res.ok) {
      templatesHint.textContent = data.error || 'No se pudieron cargar plantillas';
      return;
    }
    const templates = data.templates || [];
    if (!templates.length) {
      templatesHint.textContent = 'No hay plantillas en esta WABA.';
      return;
    }
    templatesHint.innerHTML = `Plantillas en ESTA cuenta: ${templates
      .map((t) => `<code>${esc(t.name)}/${esc(t.language)}</code> <span class="badge">${esc(t.status)}</span>`)
      .join(' · ')}`;
  } catch (err) {
    templatesHint.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function loadConversations() {
  const res = await fetch('/api/whatsapp/conversations');
  const data = await res.json();
  const conversations = data.conversations || [];

  if (conversations.length === 0) {
    conversationsList.innerHTML =
      '<div class="lead-row"><span>Sin conversaciones aún. Escribe al número de WhatsApp Business para probar.</span></div>';
    return;
  }

  conversationsList.innerHTML = conversations
    .map((c) => {
      const unread = c.unread_count > 0 ? `<span class="badge">${esc(c.unread_count)}</span>` : '';
      return `
        <a class="lead-row" href="/wa.html?id=${encodeURIComponent(c.id)}" style="text-decoration:none;color:inherit;display:grid">
          <span>${esc(c.profile_name || c.wa_id)} ${unread}</span>
          <span>${esc(c.wa_id)}</span>
          <span class="badge" style="border-color:${c.mode === 'human' ? 'var(--magenta)' : 'var(--cyan)'};color:${c.mode === 'human' ? 'var(--magenta)' : 'var(--cyan)'}">${esc(c.mode).toUpperCase()}</span>
          <span>${timeAgo(c.last_message_at)}</span>
        </a>
      `;
    })
    .join('');
}

async function showCampaignFailures(campaignId, campaignName) {
  try {
    const res = await fetch(`/api/whatsapp/campaigns/${encodeURIComponent(campaignId)}/failures`);
    const data = await res.json();
    const failures = data.failures || [];
    if (failures.length === 0) {
      alert(`${campaignName}\nSin detalle de errores guardado.`);
      return;
    }
    const lines = failures
      .map((f) => `• ${f.wa_id}: ${f.error || 'sin mensaje'}`)
      .join('\n');
    alert(`Errores de "${campaignName}" (muestra):\n\n${lines}`);
  } catch (err) {
    alert(`No se pudieron cargar errores: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function loadCampaigns() {
  const res = await fetch('/api/whatsapp/campaigns');
  const data = await res.json();
  const campaigns = data.campaigns || [];

  if (campaigns.length === 0) {
    campaignsList.innerHTML = '<div class="lead-row"><span>Sin campañas todavía.</span></div>';
    return;
  }

  campaignsList.innerHTML = campaigns
    .map(
      (c) => `
      <div class="lead-row" style="display:grid">
        <button type="button" data-campaign-id="${esc(c.id)}" data-campaign-name="${esc(c.name)}" style="width:100%;text-align:left;cursor:pointer;background:transparent;border:0;color:inherit;font:inherit;display:grid">
          <span>${esc(c.name)}</span>
          <span>${esc(c.template_name)} · lang ${esc(c.template_language)}</span>
          <span class="badge">${esc(c.status)}</span>
          <span>${esc(c.sent_count)}/${esc(c.total_targets)} · fail ${esc(c.failed_count)}</span>
        </button>
        ${
          c.status === 'sending'
            ? `<button type="button" class="btn" data-cancel-id="${esc(c.id)}" style="margin-top:0.35rem">CANCELAR</button>`
            : ''
        }
      </div>`,
    )
    .join('');

  campaignsList.querySelectorAll('[data-campaign-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      showCampaignFailures(btn.getAttribute('data-campaign-id'), btn.getAttribute('data-campaign-name'));
    });
  });
  campaignsList.querySelectorAll('[data-cancel-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-cancel-id');
      await fetch(`/api/whatsapp/campaigns/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      await loadCampaigns();
    });
  });
}

newCampaignBtn?.addEventListener('click', () => {
  if (!campaignForm) return;
  campaignForm.style.display = campaignForm.style.display === 'none' ? 'block' : 'none';
});

testFormEl?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const formData = new FormData(form);
  const bodyParams = String(formData.get('bodyParams') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const payload = {
    to: formData.get('to'),
    templateName: formData.get('templateName'),
    templateLanguage: formData.get('templateLanguage') || 'es',
    bodyParams,
  };

  const res = await fetch('/api/whatsapp/templates/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || `Error ${res.status}`);
    return;
  }
  alert(`Prueba enviada a ${payload.to}\nwaMessageId: ${data.waMessageId || 'ok'}\nRevisa WhatsApp.`);
  await loadConversations();
});

campaignFormEl?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;

  const formData = new FormData(form);
  const bodyParams = String(formData.get('bodyParams') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const leadFilter = {};
  const sector = String(formData.get('sector') || '').trim();
  const city = String(formData.get('city') || '').trim();
  if (sector) leadFilter.sector = sector;
  if (city) leadFilter.city = city;

  const lang = String(formData.get('templateLanguage') || 'es').trim() || 'es';

  const ok = confirm(
    'Esto enviará a TODOS los leads filtrados.\n¿Ya probaste con ENVIAR PRUEBA a tu número?',
  );
  if (!ok) return;

  const payload = {
    name: formData.get('name'),
    templateName: formData.get('templateName'),
    templateLanguage: lang,
    appSlug: formData.get('appSlug') || undefined,
    bodyParamsTemplate: bodyParams,
    leadFilter,
  };

  const res = await fetch('/api/whatsapp/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    alert(data.error || `Error al crear la campaña (${res.status})`);
    return;
  }

  alert(`Campaña lanzada: ${data.totalTargets} destinatarios\nIdioma: ${lang}`);
  if (campaignForm) campaignForm.style.display = 'none';
  form.reset();
  const langInput = form.querySelector('[name="templateLanguage"]');
  if (langInput instanceof HTMLInputElement) langInput.value = 'es';
  const paramsInput = form.querySelector('[name="bodyParams"]');
  if (paramsInput instanceof HTMLInputElement) paramsInput.value = '{{name}}';
  const nameInput = form.querySelector('[name="templateName"]');
  if (nameInput instanceof HTMLInputElement) nameInput.value = 'contacto_cliente';
  await loadCampaigns();
});

async function refreshAll() {
  await Promise.all([loadStatus(), loadTemplates(), loadConversations(), loadCampaigns()]);
}

await refreshAll();
setInterval(refreshAll, 10000);
