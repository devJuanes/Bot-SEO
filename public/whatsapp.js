const conversationsList = document.getElementById('conversationsList');
const campaignsList = document.getElementById('campaignsList');
const newCampaignBtn = document.getElementById('newCampaignBtn');
const campaignForm = document.getElementById('campaignForm');
const campaignFormEl = document.getElementById('campaignFormEl');
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
        <a class="lead-row" href="/whatsapp-thread.html?id=${encodeURIComponent(c.id)}" style="text-decoration:none;color:inherit;display:grid">
          <span>${esc(c.profile_name || c.wa_id)} ${unread}</span>
          <span>${esc(c.wa_id)}</span>
          <span class="badge" style="border-color:${c.mode === 'human' ? 'var(--magenta)' : 'var(--cyan)'};color:${c.mode === 'human' ? 'var(--magenta)' : 'var(--cyan)'}">${esc(c.mode).toUpperCase()}</span>
          <span>${timeAgo(c.last_message_at)}</span>
        </a>
      `;
    })
    .join('');
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
      <div class="lead-row">
        <span>${esc(c.name)}</span>
        <span>${esc(c.template_name)}</span>
        <span class="badge">${esc(c.status)}</span>
        <span>${esc(c.sent_count)}/${esc(c.total_targets)} · fail ${esc(c.failed_count)}</span>
      </div>`,
    )
    .join('');
}

newCampaignBtn?.addEventListener('click', () => {
  campaignForm.style.display = campaignForm.style.display === 'none' ? 'block' : 'none';
});

campaignFormEl?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const bodyParams = String(formData.get('bodyParams') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const leadFilter = {};
  const sector = String(formData.get('sector') || '').trim();
  const city = String(formData.get('city') || '').trim();
  if (sector) leadFilter.sector = sector;
  if (city) leadFilter.city = city;

  const payload = {
    name: formData.get('name'),
    templateName: formData.get('templateName'),
    templateLanguage: formData.get('templateLanguage') || 'es',
    appSlug: formData.get('appSlug') || undefined,
    bodyParamsTemplate: bodyParams,
    leadFilter,
  };

  const res = await fetch('/api/whatsapp/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || 'Error al crear la campaña');
    return;
  }

  alert(`Campaña lanzada: ${data.totalTargets} destinatarios`);
  campaignForm.style.display = 'none';
  event.currentTarget.reset();
  await loadCampaigns();
});

async function refreshAll() {
  await Promise.all([loadStatus(), loadConversations(), loadCampaigns()]);
}

await refreshAll();
setInterval(refreshAll, 10000);
