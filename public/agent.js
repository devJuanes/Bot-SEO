const params = new URLSearchParams(location.search);
const agentId = params.get('id');
const sessionId = `ui-${agentId || 'unknown'}`;

const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const runBtn = document.getElementById('runBtn');

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function appendChat(role, content) {
  const line = document.createElement('div');
  line.className = `log-line ${role === 'user' ? 'info' : 'success'}`;
  line.innerHTML = `<strong>${esc(role)}</strong> · ${esc(content)}`;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function loadAgent() {
  if (!agentId) {
    document.getElementById('agentName').textContent = 'Agent not found';
    return;
  }

  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`);
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('agentName').textContent = data.error || 'Error';
    return;
  }

  const agent = data.agent;
  const runtime = data.runtime || {};
  document.getElementById('agentTitle').textContent = agent.id;
  document.getElementById('agentName').textContent = agent.name;
  document.getElementById('agentRole').textContent = agent.role;
  document.getElementById('agentDesc').textContent = agent.description;
  document.getElementById('agentCaps').textContent = `Capabilities: ${(agent.capabilities || []).join(', ')}`;
  document.getElementById('agentStatus').textContent = (runtime.status || 'idle').toUpperCase();
  document.getElementById('statRuns').textContent = runtime.runCount ?? 0;
  document.getElementById('statOk').textContent = runtime.successCount ?? 0;
  document.getElementById('statErr').textContent = runtime.errorCount ?? 0;

  const hist = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/chat?sessionId=${encodeURIComponent(sessionId)}`,
  ).then((r) => r.json());
  chatLog.innerHTML = '';
  for (const msg of hist.messages || []) {
    appendChat(msg.role, msg.content);
  }
}

chatForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message || !agentId) return;
  appendChat('user', message);
  chatInput.value = '';
  chatInput.disabled = true;

  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });
  const data = await res.json();
  chatInput.disabled = false;
  chatInput.focus();

  if (!res.ok) {
    appendChat('assistant', data.error || 'Error');
    return;
  }
  appendChat('assistant', data.reply);
});

runBtn?.addEventListener('click', async () => {
  if (!agentId) return;
  runBtn.disabled = true;
  appendChat('system', `Ejecutando ${agentId}…`);
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await res.json();
  runBtn.disabled = false;
  appendChat(
    'assistant',
    res.ok
      ? `Run result: ${data.result?.status} · ${data.result?.reason || ''}`
      : data.error || 'Run failed',
  );
  await loadAgent();
});

await loadAgent();
