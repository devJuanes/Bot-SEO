const agentsEl = document.getElementById('agentsGrid');
const agentsEmpty = document.getElementById('agentsEmpty');
const logEl = document.getElementById('logTerminal');
const busEl = document.getElementById('busFeed');
const leadsEl = document.getElementById('leadsTable');
const oppsEl = document.getElementById('oppsTable');
const contentEl = document.getElementById('contentTable');
const refreshBtn = document.getElementById('refreshBtn');
const addAgentBtn = document.getElementById('addAgentBtn');
const catalogModal = document.getElementById('catalogModal');
const catalogList = document.getElementById('catalogList');
const configModal = document.getElementById('agentConfigModal');
const statsRow = document.getElementById('statsRow');

let configAgentId = null;
let dashboardLoading = false;

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function fmtDuration(ms) {
  if (ms == null) return '--';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function projectId() {
  return window.GrowthAuth?.getProjectId?.();
}

async function projectApi(path, options = {}) {
  const pid = projectId();
  return GrowthAuth.api(`/api/projects/${pid}${path}`, options);
}

function setLoading(loading) {
  dashboardLoading = loading;
  agentsEl.classList.toggle('loading', loading);
  if (loading) {
    agentsEl.classList.remove('hidden');
    agentsEmpty?.classList.add('hidden');
  }
}

function renderStats(data) {
  const stats = data.stats || {};
  statsRow.innerHTML = `
    <div class="stat-card">
      <span class="stat-label">Leads</span>
      <span class="stat-value">${esc(stats.leadsApprox ?? 0)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Oportunidades</span>
      <span class="stat-value">${esc(stats.opportunities ?? 0)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Blogs</span>
      <span class="stat-value">${esc(stats.blogs ?? 0)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Agentes activos</span>
      <span class="stat-value">${esc(stats.agentsEnabled ?? 0)}</span>
    </div>
  `;
}

function renderAgents(agents = []) {
  agentsEl.classList.remove('loading');
  if (!agents.length) {
    agentsEl.innerHTML = '';
    agentsEl.classList.add('hidden');
    agentsEmpty?.classList.remove('hidden');
    return;
  }

  agentsEmpty?.classList.add('hidden');
  agentsEl.classList.remove('hidden');
  agentsEl.innerHTML = agents
    .map((agent) => {
      const status = agent.status || 'idle';
      let task = agent.currentTask || 'En espera';
      if (status === 'running' && agent.lastStartedAt) {
        const elapsedSec = Math.max(
          0,
          Math.round((Date.now() - new Date(agent.lastStartedAt).getTime()) / 1000),
        );
        task = `${task} · ${elapsedSec}s`;
      }
      return `
        <article class="agent-card ${esc(status)}">
          <div class="agent-card-top">
            <span class="status-dot ${esc(status)}"></span>
            <div class="agent-actions">
              <button class="btn-icon" data-config="${esc(agent.id)}" title="Configurar">⚙</button>
              <button class="btn-icon" data-run="${esc(agent.id)}" title="Ejecutar">▶</button>
            </div>
          </div>
          <a href="/agent.html?id=${encodeURIComponent(agent.id)}" class="agent-link">
            <h3>${esc(agent.name)}</h3>
            <p class="agent-role">${esc(agent.role)}</p>
            <p class="agent-task">${esc(task)}</p>
          </a>
          <p class="agent-meta">
            ${esc(agent.runCount ?? 0)} runs · ${esc(agent.successCount ?? 0)} ok ·
            ${esc(fmtDuration(agent.lastDurationMs))}
            ${agent.autopilot_enabled ? '<span class="tag">autopilot</span>' : ''}
          </p>
        </article>
      `;
    })
    .join('');

  agentsEl.querySelectorAll('[data-run]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-run');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/agents/${id}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + GrowthAuth.getToken(),
            'X-Project-Id': projectId(),
          },
          body: '{}',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Error al ejecutar agente');
        }
        await refreshDashboard();
      } finally {
        btn.disabled = false;
      }
    });
  });

  agentsEl.querySelectorAll('[data-config]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAgentConfig(btn.getAttribute('data-config'), agents);
    });
  });
}

function renderLogs(logs = []) {
  logEl.innerHTML = logs
    .slice(0, 80)
    .map((log) => {
      const time = new Date(log.ts).toLocaleTimeString();
      return `<div class="log-line ${esc(log.level)}">[${esc(time)}] ${esc(log.agentId || 'sys')} · ${esc(log.message)}</div>`;
    })
    .join('');
}

function renderBus(messages = []) {
  busEl.innerHTML = messages
    .slice(0, 40)
    .map((msg) => {
      return `<div class="bus-line"><strong>${esc(msg.from)} → ${esc(msg.to)}</strong> · ${esc(msg.topic)}<br/>${esc(msg.body)}</div>`;
    })
    .join('');
}

function renderLeads(leads = []) {
  if (!leads.length) {
    leadsEl.innerHTML = `<div class="data-row muted">Sin leads aún.</div>`;
    return;
  }
  leadsEl.innerHTML = leads
    .map(
      (lead) => `
      <div class="data-row">
        <span class="data-primary">${esc(lead.name)}</span>
        <span>${esc(lead.city || '--')} · ${esc(lead.country || '--')}</span>
        <span>${esc(lead.business_type || lead.source || '--')}</span>
        <span>${lead.needs_website ? '<span class="tag tag-success">Sin web</span>' : '—'}</span>
      </div>`,
    )
    .join('');
}

function renderOpps(opps = []) {
  if (!opps.length) {
    oppsEl.innerHTML = `<div class="data-row muted">Sin oportunidades detectadas.</div>`;
    return;
  }
  oppsEl.innerHTML = opps
    .map(
      (opp) => `
      <div class="data-row">
        <span class="data-primary">${esc(opp.title)}</span>
        <span>${esc(opp.opportunity_type)} · ${esc(opp.source)}</span>
        <span>${esc(opp.city || '--')}</span>
        <span><span class="tag">${esc(opp.status)}</span></span>
      </div>`,
    )
    .join('');
}

function renderContent(blogs = [], scripts = [], briefs = [], apps = 0) {
  const rows = [
    ...briefs.map(
      (b) =>
        `<div class="data-row"><span class="data-primary">Brief · ${esc(b.title)}</span><span>${esc(b.sector || '')}</span><span>${esc(b.status)}</span><span>${esc((b.problem || '').slice(0, 50))}</span></div>`,
    ),
    ...blogs.map(
      (b) =>
        `<div class="data-row"><span class="data-primary">Blog · ${esc(b.title)}</span><span>${esc(b.city || '')}</span><span>${esc(b.status)}</span><span>${esc(b.slug)}</span></div>`,
    ),
    ...scripts.map(
      (s) =>
        `<div class="data-row"><span class="data-primary">Social · ${esc(s.topic)}</span><span>${esc(s.platform)}</span><span>${esc(s.status)}</span><span>${esc((s.hook || '').slice(0, 40))}</span></div>`,
    ),
  ];
  if (rows.length) {
    contentEl.innerHTML = rows.join('');
    return;
  }
  contentEl.innerHTML = `<div class="data-row muted">Sin contenido generado. Apps conectadas: ${esc(apps)}</div>`;
}

async function refreshDashboard() {
  if (!dashboardLoading) setLoading(true);
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();

    const subtitle = document.getElementById('projectSubtitle');
    if (subtitle) {
      subtitle.textContent = data.project?.name
        ? `Proyecto: ${data.project.name}`
        : 'Proyecto activo';
    }

    const auto = data.autopilot?.enabled;
    const pill = document.getElementById('autopilotPill');
    pill.textContent = auto ? 'Autopilot ON' : 'Autopilot OFF';
    pill.classList.toggle('on', Boolean(auto));
    pill.classList.toggle('off', !auto);

    renderStats(data);
    renderAgents(data.agents || []);
    renderLogs(data.logs || []);
    renderBus(data.bus || []);
    renderLeads(data.leads || []);
    renderOpps(data.opportunities || []);
    renderContent(
      data.blogs || [],
      data.scripts || [],
      data.briefs || [],
      data.stats?.apps ?? 0,
    );
  } finally {
    setLoading(false);
  }
}

async function openCatalog() {
  catalogModal.classList.remove('hidden');
  catalogList.innerHTML = '<div class="catalog-item skeleton"></div>'.repeat(4);
  const res = await projectApi('/agents/catalog');
  const data = await res.json();
  catalogList.innerHTML = (data.catalog || [])
    .map((item) => {
      const added = item.added && item.is_enabled;
      return `
        <div class="catalog-item">
          <div>
            <strong>${esc(item.name)}</strong>
            <p>${esc(item.description)}</p>
            <span class="tag">${esc(item.role)}</span>
          </div>
          <button
            class="btn ${added ? 'btn-secondary' : 'btn-primary'} btn-sm"
            data-add-agent="${esc(item.id)}"
            ${added ? 'disabled' : ''}
          >
            ${added ? 'Añadido' : 'Añadir'}
          </button>
        </div>
      `;
    })
    .join('');

  catalogList.querySelectorAll('[data-add-agent]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const agentId = btn.getAttribute('data-add-agent');
      btn.disabled = true;
      try {
        await projectApi('/agents', {
          method: 'POST',
          body: JSON.stringify({ agentId }),
        });
        catalogModal.classList.add('hidden');
        await refreshDashboard();
      } catch {
        alert('No se pudo añadir el agente');
      }
    });
  });
}

function openAgentConfig(agentId, agents) {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return;
  configAgentId = agentId;
  document.getElementById('configAgentName').textContent = agent.name;
  document.getElementById('configEnabled').checked = agent.is_enabled !== false;
  document.getElementById('configAutopilot').checked = Boolean(agent.autopilot_enabled);
  configModal.classList.remove('hidden');
}

async function saveAgentConfig() {
  if (!configAgentId) return;
  await projectApi(`/agents/${configAgentId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      is_enabled: document.getElementById('configEnabled').checked,
      autopilot_enabled: document.getElementById('configAutopilot').checked,
    }),
  });
  configModal.classList.add('hidden');
  configAgentId = null;
  await refreshDashboard();
}

function connectEvents() {
  const pid = projectId();
  const qs = pid ? `?projectId=${encodeURIComponent(pid)}` : '';
  const source = new EventSource(`/api/events${qs}`);
  source.addEventListener('log', (event) => {
    const log = JSON.parse(event.data);
    const time = new Date(log.ts).toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `log-line ${log.level}`;
    line.textContent = `[${time}] ${log.agentId || 'sys'} · ${log.message}`;
    logEl.prepend(line);
  });
  source.addEventListener('agent', () => {
    void refreshDashboard();
  });
  source.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const line = document.createElement('div');
    line.className = 'bus-line';
    line.innerHTML = `<strong>${esc(msg.from)} → ${esc(msg.to)}</strong> · ${esc(msg.topic)}<br/>${esc(msg.body)}`;
    busEl.prepend(line);
  });
}

refreshBtn?.addEventListener('click', () => void refreshDashboard());
addAgentBtn?.addEventListener('click', () => void openCatalog());
document.querySelectorAll('[data-open-catalog]').forEach((el) => {
  el.addEventListener('click', () => void openCatalog());
});
document.querySelectorAll('[data-close-modal]').forEach((el) => {
  el.addEventListener('click', () => catalogModal.classList.add('hidden'));
});
document.querySelectorAll('[data-close-config]').forEach((el) => {
  el.addEventListener('click', () => {
    configModal.classList.add('hidden');
    configAgentId = null;
  });
});
document.getElementById('saveAgentConfig')?.addEventListener('click', () => {
  void saveAgentConfig();
});

setInterval(() => {
  const clock = document.getElementById('clockPill');
  if (clock) clock.textContent = new Date().toLocaleTimeString();
}, 1000);

await refreshDashboard();
connectEvents();
setInterval(() => void refreshDashboard(), 12000);
