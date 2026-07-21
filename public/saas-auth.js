/**
 * Shared SaaS auth helpers for cockpit pages.
 * Stores JWT + active project in localStorage.
 */
(function (global) {
  const TOKEN_KEY = 'growth_token';
  const PROJECT_KEY = 'growth_project_id';
  const ORG_KEY = 'growth_org_id';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setSession(token, projectId, orgId) {
    localStorage.setItem(TOKEN_KEY, token);
    if (projectId) localStorage.setItem(PROJECT_KEY, projectId);
    if (orgId) localStorage.setItem(ORG_KEY, orgId);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROJECT_KEY);
    localStorage.removeItem(ORG_KEY);
  }

  function getProjectId() {
    return localStorage.getItem(PROJECT_KEY);
  }

  function setProjectId(id) {
    localStorage.setItem(PROJECT_KEY, id);
  }

  function requireAuthOrRedirect() {
    if (!getToken()) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = '/login.html?next=' + next;
      return false;
    }
    return true;
  }

  async function api(path, options = {}) {
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {},
    );
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    const projectId = getProjectId();
    if (projectId) headers['X-Project-Id'] = projectId;

    const res = await fetch(path, Object.assign({}, options, { headers, credentials: 'include' }));
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    return res;
  }

  async function loadMe() {
    const res = await fetch('/api/auth/me', {
      headers: (function () {
        const h = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) h.Authorization = 'Bearer ' + token;
        const projectId = getProjectId();
        if (projectId) h['X-Project-Id'] = projectId;
        return h;
      })(),
      credentials: 'include',
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('me failed');
    return res.json();
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
      });
    } catch (_) {
      /* ignore */
    }
    clearSession();
    location.href = '/login.html';
  }

  function mountProjectSwitcher(container, me) {
    if (!container || !me) return;
    const orgs = me.organizations || [];
    const byOrg = me.projectsByOrg || {};
    const allProjects = [];
    for (const org of orgs) {
      for (const p of byOrg[org.id] || []) {
        allProjects.push({ org: org, project: p });
      }
    }
    if (allProjects.length === 0) {
      container.innerHTML = '<span class="pill">Sin proyectos</span>';
      return;
    }
    if (!getProjectId() && allProjects[0]) {
      setProjectId(allProjects[0].project.id);
      localStorage.setItem(ORG_KEY, allProjects[0].org.id);
    }
    const current = getProjectId();
    const select = document.createElement('select');
    select.className = 'project-switcher';
    select.title = 'Proyecto activo';
    for (const item of allProjects) {
      const opt = document.createElement('option');
      opt.value = item.project.id;
      opt.textContent =
        item.org.name + ' · ' + item.project.name + ' (' + item.project.type + ')';
      if (item.project.id === current) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      setProjectId(select.value);
      const found = allProjects.find((x) => x.project.id === select.value);
      if (found) localStorage.setItem(ORG_KEY, found.org.id);
      location.reload();
    });
    container.innerHTML = '';
    container.appendChild(select);

    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.type = 'button';
    btn.textContent = 'SALIR';
    btn.style.cursor = 'pointer';
    btn.onclick = () => logout();
    container.appendChild(btn);
  }

  // Auto-inject auth headers for cockpit API calls
  const _fetch = global.fetch.bind(global);
  global.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (
      typeof url === 'string' &&
      (url.startsWith('/api/') || url.startsWith('/agents')) &&
      !url.startsWith('/api/auth/')
    ) {
      init = Object.assign({}, init || {});
      const headers = new Headers(init.headers || {});
      const token = getToken();
      if (token) headers.set('Authorization', 'Bearer ' + token);
      const projectId = getProjectId();
      if (projectId) headers.set('X-Project-Id', projectId);
      init.headers = headers;
      init.credentials = 'include';
    }
    return _fetch(input, init);
  };

  async function ensureProjectReady() {
    if (getProjectId()) return;
    const me = await loadMe();
    const orgs = me.organizations || [];
    const byOrg = me.projectsByOrg || {};
    for (const org of orgs) {
      const projects = byOrg[org.id] || [];
      if (projects[0]) {
        setProjectId(projects[0].id);
        localStorage.setItem(ORG_KEY, org.id);
        return;
      }
    }
  }

  global.GrowthAuth = {
    getToken,
    setSession,
    clearSession,
    getProjectId,
    setProjectId,
    requireAuthOrRedirect,
    ensureProjectReady,
    api,
    loadMe,
    logout,
    mountProjectSwitcher,
  };
})(window);
