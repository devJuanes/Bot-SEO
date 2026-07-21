const waApp = document.getElementById('waApp');
const chatList = document.getElementById('chatList');
const searchInput = document.getElementById('searchInput');
const waStatus = document.getElementById('waStatus');
const emptyState = document.getElementById('emptyState');
const activeChat = document.getElementById('activeChat');
const messagesEl = document.getElementById('messages');
const chatTitle = document.getElementById('chatTitle');
const chatBiz = document.getElementById('chatBiz');
const chatSubtitle = document.getElementById('chatSubtitle');
const chatAvatar = document.getElementById('chatAvatar');
const modeChip = document.getElementById('modeChip');
const toggleModeBtn = document.getElementById('toggleModeBtn');
const composeForm = document.getElementById('composeForm');
const composeInput = document.getElementById('composeInput');
const sendBtn = document.getElementById('sendBtn');
const refreshBtn = document.getElementById('refreshBtn');
const backBtn = document.getElementById('backBtn');

/** @type {Array<any>} */
let conversations = [];
/** @type {string | null} */
let selectedId = new URLSearchParams(location.search).get('id');
/** @type {any | null} */
let selectedConversation = null;
let currentMode = 'bot';
let lastMessageCount = 0;

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function initials(name) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[1][0]).slice(0, 2);
}

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Hoy';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Ayer';
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function businessLabel(c) {
  const parts = [c.business_type, c.lead_city].filter(Boolean);
  return parts.join(' · ');
}

function setSelected(id) {
  selectedId = id;
  const url = new URL(location.href);
  if (id) url.searchParams.set('id', id);
  else url.searchParams.delete('id');
  history.replaceState(null, '', url);
  waApp.classList.toggle('show-chat', Boolean(id));
  if (window.matchMedia('(max-width: 900px)').matches) {
    backBtn.style.display = id ? 'inline-grid' : 'none';
  }
}

function renderMode() {
  modeChip.textContent = currentMode.toUpperCase();
  modeChip.classList.toggle('human', currentMode === 'human');
  toggleModeBtn.textContent =
    currentMode === 'human' ? 'Devolver a IA' : 'Tomar control';
}

function renderList() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = conversations.filter((c) => {
    if (!q) return true;
    const hay = `${c.profile_name || ''} ${c.wa_id || ''} ${c.business_type || ''} ${c.lead_name || ''} ${c.lead_city || ''}`.toLowerCase();
    return hay.includes(q);
  });

  if (!filtered.length) {
    chatList.innerHTML = `<div class="wa-empty">No hay chats${q ? ' con ese filtro' : ' todavía'}.</div>`;
    return;
  }

  chatList.innerHTML = filtered
    .map((c) => {
      const name = c.profile_name || c.lead_name || c.wa_id;
      const unread =
        c.unread_count > 0 ? `<span class="wa-badge">${esc(c.unread_count)}</span>` : '';
      const modeClass = c.mode === 'human' ? 'human' : '';
      const biz = businessLabel(c);
      return `
        <button type="button" class="wa-item ${c.id === selectedId ? 'active' : ''}" data-id="${esc(c.id)}">
          <div class="wa-avatar">${esc(initials(name))}</div>
          <div class="wa-item-main">
            <div class="wa-item-top">
              <div class="wa-item-name">${esc(name)}</div>
              <div class="wa-item-time">${esc(timeLabel(c.last_message_at || c.updated_at))}</div>
            </div>
            ${biz ? `<div class="wa-item-biz">${esc(biz)}</div>` : ''}
            <div class="wa-item-bottom">
              <div class="wa-item-preview">${esc(c.wa_id)} · <span class="wa-mode-chip ${modeClass}">${esc(c.mode || 'bot')}</span></div>
              ${unread}
            </div>
          </div>
        </button>`;
    })
    .join('');

  chatList.querySelectorAll('[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openChat(btn.getAttribute('data-id'));
    });
  });
}

function mediaHtml(msg) {
  const meta = msg.metadata || {};
  const url = meta.mediaUrl;
  const type = msg.message_type || 'text';
  const caption = msg.content || '';
  const isPlaceholder =
    /^[🎤📷🎬📄]/.test(caption) || caption.startsWith('[') || caption === 'Sticker';

  if (!url) {
    if (type === 'text') return `<div class="wa-bubble-body">${esc(caption)}</div>`;
    return `<div class="wa-media-fallback">${esc(caption || `Media ${type} (no disponible)`)}</div>`;
  }

  if (type === 'image' || type === 'sticker') {
    return `
      <a href="${esc(url)}" target="_blank" rel="noopener">
        <img class="wa-media" src="${esc(url)}" alt="${esc(caption || 'Imagen')}" loading="lazy" />
      </a>
      ${caption && !isPlaceholder ? `<div class="wa-bubble-body">${esc(caption)}</div>` : ''}`;
  }

  if (type === 'audio') {
    return `
      <audio class="wa-media audio" controls preload="metadata" src="${esc(url)}"></audio>
      ${caption && !isPlaceholder ? `<div class="wa-bubble-body">${esc(caption)}</div>` : ''}`;
  }

  if (type === 'video') {
    return `
      <video class="wa-media video" controls preload="metadata" src="${esc(url)}"></video>
      ${caption && !isPlaceholder ? `<div class="wa-bubble-body">${esc(caption)}</div>` : ''}`;
  }

  if (type === 'document') {
    const name = meta.filename || caption || 'Documento';
    return `
      <a class="wa-doc-link" href="${esc(url)}" target="_blank" rel="noopener">📄 ${esc(name)}</a>
      ${caption && caption !== name && !isPlaceholder ? `<div class="wa-bubble-body">${esc(caption)}</div>` : ''}`;
  }

  return `<div class="wa-bubble-body">${esc(caption)}</div>`;
}

function renderMessages(messages) {
  const atBottom =
    messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
  let html = '';
  let lastDay = '';

  for (const msg of messages) {
    const dk = dayKey(msg.created_at);
    if (dk !== lastDay) {
      lastDay = dk;
      html += `<div class="wa-day"><span>${esc(dayLabel(msg.created_at))}</span></div>`;
    }
    const outbound = msg.direction === 'outbound' || msg.sender_type !== 'customer';
    const sender =
      msg.sender_type === 'human'
        ? 'Tú'
        : msg.sender_type === 'bot'
          ? 'Bot'
          : msg.sender_type === 'system'
            ? 'Sistema'
            : '';
    const showTag = outbound && (msg.sender_type === 'bot' || msg.sender_type === 'human' || msg.sender_type === 'system');
    html += `
      <div class="wa-bubble-row ${outbound ? 'out' : 'in'}">
        <div class="wa-bubble">
          ${showTag ? `<div class="wa-sender-tag">${esc(sender)}</div>` : ''}
          ${mediaHtml(msg)}
          <div class="wa-bubble-meta">
            <span>${esc(timeLabel(msg.created_at))}</span>
          </div>
        </div>
      </div>`;
  }

  messagesEl.innerHTML = html || `<div class="wa-empty">Sin mensajes en este chat.</div>`;
  if (atBottom || messages.length !== lastMessageCount) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  lastMessageCount = messages.length;
}

async function loadConversations() {
  const res = await fetch('/api/whatsapp/conversations');
  const data = await res.json();
  if (!res.ok) {
    chatList.innerHTML = `<div class="wa-empty">${esc(data.error || 'Error cargando chats')}</div>`;
    return;
  }
  conversations = data.conversations || [];
  renderList();
}

function fillChatHeader(conversation) {
  const name = conversation.profile_name || conversation.lead_name || conversation.wa_id;
  chatTitle.textContent = name;
  const biz = businessLabel(conversation);
  if (biz) {
    chatBiz.hidden = false;
    chatBiz.textContent = biz;
  } else {
    chatBiz.hidden = true;
    chatBiz.textContent = '';
  }
  chatSubtitle.textContent = conversation.wa_id;
  chatAvatar.textContent = initials(name);
}

async function openChat(id) {
  if (!id) return;
  setSelected(id);
  emptyState.hidden = true;
  activeChat.hidden = false;
  renderList();

  const res = await fetch(`/api/whatsapp/conversations/${encodeURIComponent(id)}/messages`);
  const data = await res.json();
  if (!res.ok) {
    messagesEl.innerHTML = `<div class="wa-empty">${esc(data.error || 'Error')}</div>`;
    return;
  }

  selectedConversation = data.conversation;
  currentMode = data.conversation.mode || 'bot';
  fillChatHeader(data.conversation);
  renderMode();
  renderMessages(data.messages || []);
  composeInput.focus();
}

async function refreshActiveChat() {
  if (!selectedId) return;
  const res = await fetch(
    `/api/whatsapp/conversations/${encodeURIComponent(selectedId)}/messages`,
  );
  const data = await res.json();
  if (!res.ok) return;
  selectedConversation = data.conversation;
  currentMode = data.conversation.mode || 'bot';
  fillChatHeader(data.conversation);
  renderMode();
  renderMessages(data.messages || []);
}

composeForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = composeInput.value.trim();
  if (!text || !selectedId) return;

  composeInput.value = '';
  composeInput.style.height = 'auto';
  sendBtn.disabled = true;

  const res = await fetch(
    `/api/whatsapp/conversations/${encodeURIComponent(selectedId)}/reply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
  );
  const data = await res.json().catch(() => ({}));
  sendBtn.disabled = false;
  composeInput.focus();

  if (!res.ok) {
    alert(data.error || 'No se pudo enviar');
    composeInput.value = text;
    return;
  }

  currentMode = 'human';
  renderMode();
  await refreshActiveChat();
  await loadConversations();
});

toggleModeBtn?.addEventListener('click', async () => {
  if (!selectedId) return;
  const nextMode = currentMode === 'human' ? 'bot' : 'human';
  const res = await fetch(
    `/api/whatsapp/conversations/${encodeURIComponent(selectedId)}/mode`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode }),
    },
  );
  if (res.ok) {
    currentMode = nextMode;
    renderMode();
    await loadConversations();
  }
});

composeInput?.addEventListener('input', () => {
  composeInput.style.height = 'auto';
  composeInput.style.height = `${Math.min(composeInput.scrollHeight, 120)}px`;
});

composeInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    composeForm.requestSubmit();
  }
});

searchInput?.addEventListener('input', renderList);
refreshBtn?.addEventListener('click', async () => {
  await loadConversations();
  await refreshActiveChat();
});
backBtn?.addEventListener('click', () => {
  setSelected(null);
  activeChat.hidden = true;
  emptyState.hidden = false;
  renderList();
});

async function boot() {
  try {
    const statusRes = await fetch('/api/whatsapp/status');
    const status = await statusRes.json();
    waStatus.textContent = status.configured
      ? 'MatuByte · conectado'
      : 'MatuByte · sin configurar';
  } catch {
    waStatus.textContent = 'MatuByte · offline';
  }

  if (window.matchMedia('(max-width: 900px)').matches) {
    backBtn.style.display = selectedId ? 'inline-grid' : 'none';
  }

  await loadConversations();
  if (selectedId) await openChat(selectedId);

  setInterval(async () => {
    await loadConversations();
    await refreshActiveChat();
  }, 5000);
}

await boot();
