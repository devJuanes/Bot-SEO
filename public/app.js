const agentsEl = document.getElementById('agentsGrid');
const logEl = document.getElementById('logTerminal');
const busEl = document.getElementById('busFeed');
const leadsEl = document.getElementById('leadsTable');
const oppsEl = document.getElementById('oppsTable');
const contentEl = document.getElementById('contentTable');
const refreshBtn = document.getElementById('refreshBtn');

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

function renderAgents(agents = []) {
  agentsEl.innerHTML = agents
    .map((agent) => {
      const status = agent.status || 'idle';
      let task = agent.currentTask || 'IDLE · tap to open chat';
      if (status === 'running' && agent.lastStartedAt) {
        const elapsedSec = Math.max(
          0,
          Math.round((Date.now() - new Date(agent.lastStartedAt).getTime()) / 1000),
        );
        task = `${task} · ${elapsedSec}s`;
      }
      return `
        <a class="agent-card ${esc(status)}" href="/agent.html?id=${encodeURIComponent(agent.id)}">
          <span class="led ${esc(status)}"></span>
          <div class="robot" aria-hidden="true"></div>
          <h3 class="agent-name">${esc(agent.name)}</h3>
          <p class="agent-task">${esc(task)}</p>
          <p class="agent-meta">
            runs ${esc(agent.runCount)} · ok ${esc(agent.successCount)} · err ${esc(agent.errorCount)} ·
            last ${esc(fmtDuration(agent.lastDurationMs))}
          </p>
        </a>
      `;
    })
    .join('');
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
    leadsEl.innerHTML = `<div class="lead-row"><span>Sin leads aún.</span></div>`;
    return;
  }
  leadsEl.innerHTML = leads
    .map(
      (lead) => `
      <div class="lead-row">
        <span>${esc(lead.name)}</span>
        <span>${esc(lead.city || '--')} · ${esc(lead.country || '--')}</span>
        <span>${esc(lead.business_type || lead.source || '--')}</span>
        <span>${lead.needs_website ? '<span class="badge">NEEDS WEB</span>' : '—'}</span>
      </div>`,
    )
    .join('');
}

function renderOpps(opps = []) {
  if (!opps.length) {
    oppsEl.innerHTML = `<div class="lead-row"><span>Scout aún sin hallazgos (empleos/gov/foros).</span></div>`;
    return;
  }
  oppsEl.innerHTML = opps
    .map(
      (opp) => `
      <div class="lead-row">
        <span>${esc(opp.title)}</span>
        <span>${esc(opp.opportunity_type)} · ${esc(opp.source)}</span>
        <span>${esc(opp.city || '--')}</span>
        <span><span class="badge">${esc(opp.status)}</span></span>
      </div>`,
    )
    .join('');
}

function renderContent(blogs = [], scripts = [], briefs = [], apps = 0) {
  const rows = [
    ...briefs.map(
      (b) =>
        `<div class="lead-row"><span>BRIEF · ${esc(b.title)}</span><span>${esc(b.sector || '')} · ${esc(b.city || '')}</span><span>${esc(b.status)}</span><span>${esc((b.problem || '').slice(0, 50))}</span></div>`,
    ),
    ...blogs.map(
      (b) =>
        `<div class="lead-row"><span>BLOG · ${esc(b.title)}</span><span>${esc(b.city || '')}</span><span>${esc(b.status)}</span><span>${esc(b.slug)}</span></div>`,
    ),
    ...scripts.map(
      (s) =>
        `<div class="lead-row"><span>SOCIAL · ${esc(s.topic)}</span><span>${esc(s.platform)}</span><span>${esc(s.status)}</span><span>${esc((s.hook || '').slice(0, 40))}</span></div>`,
    ),
  ];
  if (rows.length) {
    contentEl.innerHTML = rows.join('');
    return;
  }
  contentEl.innerHTML = `<div class="lead-row"><span>Aún vacío. Flujo: Cazador/Scout → Radar (briefs) → Redactor (blog). Apps: ${esc(apps)}</span></div>`;
}

async function refreshDashboard() {
  const res = await fetch('/api/dashboard');
  const data = await res.json();

  document.getElementById('statLeads').textContent = data.stats?.leadsApprox ?? 0;
  document.getElementById('statOpps').textContent = data.stats?.opportunities ?? 0;
  document.getElementById('statBlogs').textContent = data.stats?.blogs ?? 0;
  document.getElementById('phasePill').textContent = `PHASE ${data.phase ?? 4}`;

  const auto = data.autopilot?.enabled;
  const pill = document.getElementById('autopilotPill');
  pill.textContent = auto ? 'AUTOPILOT ON' : 'AUTOPILOT OFF';
  pill.classList.toggle('on', Boolean(auto));

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
}

function connectEvents() {
  const source = new EventSource('/api/events');
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

refreshBtn?.addEventListener('click', () => {
  void refreshDashboard();
});

setInterval(() => {
  document.getElementById('clockPill').textContent = new Date().toLocaleTimeString();
}, 1000);

await refreshDashboard();
connectEvents();
setInterval(() => {
  void refreshDashboard();
}, 12000);
