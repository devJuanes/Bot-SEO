const params = new URLSearchParams(location.search);
const conversationId = params.get('id');

const chatLog = document.getElementById('chatLog');
const replyForm = document.getElementById('replyForm');
const replyInput = document.getElementById('replyInput');
const threadTitle = document.getElementById('threadTitle');
const modePill = document.getElementById('modePill');
const toggleModeBtn = document.getElementById('toggleModeBtn');

let currentMode = 'bot';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function appendMessage(msg) {
  const line = document.createElement('div');
  const levelClass =
    msg.sender_type === 'customer'
      ? 'info'
      : msg.sender_type === 'human'
        ? 'success'
        : msg.sender_type === 'bot'
          ? 'bus'
          : 'warn';
  line.className = `log-line ${levelClass}`;
  const time = new Date(msg.created_at).toLocaleTimeString();
  line.innerHTML = `<strong>${esc(msg.sender_type)}</strong> · [${esc(time)}] ${esc(msg.content)}`;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderModePill() {
  modePill.textContent = currentMode.toUpperCase();
  modePill.classList.toggle('on', currentMode === 'human');
  toggleModeBtn.textContent = currentMode === 'human' ? 'DEVOLVER A IA' : 'TOMAR CONTROL';
}

async function load() {
  if (!conversationId) {
    threadTitle.textContent = 'Sin conversación';
    return;
  }

  const res = await fetch(`/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`);
  const data = await res.json();
  if (!res.ok) {
    threadTitle.textContent = data.error || 'Error';
    return;
  }

  threadTitle.textContent = data.conversation.profile_name || data.conversation.wa_id;
  currentMode = data.conversation.mode;
  renderModePill();

  chatLog.innerHTML = '';
  for (const msg of data.messages) {
    appendMessage(msg);
  }
}

replyForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = replyInput.value.trim();
  if (!text || !conversationId) return;

  replyInput.value = '';
  replyInput.disabled = true;

  const res = await fetch(`/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  replyInput.disabled = false;
  replyInput.focus();

  if (!res.ok) {
    alert(data.error || 'Error al enviar');
    return;
  }

  await load();
});

toggleModeBtn?.addEventListener('click', async () => {
  if (!conversationId) return;
  const nextMode = currentMode === 'human' ? 'bot' : 'human';

  const res = await fetch(`/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: nextMode }),
  });

  if (res.ok) {
    currentMode = nextMode;
    renderModePill();
  }
});

await load();
setInterval(load, 8000);
