const cfgPill = document.getElementById('cfgPill');
const cfgHint = document.getElementById('cfgHint');
const pendingList = document.getElementById('pendingList');
const recentList = document.getElementById('recentList');

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function card(post, { editable = false } = {}) {
  const id = post.id;
  const status = post.publish_status || 'draft';
  const meta =
    post.metadata && typeof post.metadata === 'object' ? post.metadata : {};
  const mediaType =
    meta.media_type === 'video' ||
    /\.(mp4|mov|webm)(\?|$)/i.test(String(post.fb_photo_url || ''))
      ? 'video'
      : post.fb_photo_url
        ? 'image'
        : 'none';
  const thumb = meta.media_thumb || post.fb_photo_url;
  const photo =
    mediaType === 'video' && post.fb_photo_url
      ? `<p class="fb-meta">🎬 VIDEO</p>
         <video src="${esc(post.fb_photo_url)}" controls muted playsinline style="width:100%;max-height:220px;background:#000"></video>
         ${thumb ? `<p class="fb-meta">thumb: ${esc(thumb)}</p>` : ''}`
      : mediaType === 'image' && post.fb_photo_url
        ? `<p class="fb-meta">🖼 IMAGE</p>
           <img src="${esc(post.fb_photo_url)}" alt="" style="width:100%;max-height:220px;object-fit:cover;display:block" />`
        : '';
  const seo = post.seo_title
    ? `<p class="fb-meta">SEO: ${esc(post.seo_title)}</p>`
    : '';
  const err = post.error_message
    ? `<p class="fb-meta" style="color:#f66">⚠ ${esc(post.error_message)}</p>`
    : '';
  const link = post.fb_permalink_url
    ? `<a href="${esc(post.fb_permalink_url)}" target="_blank" rel="noopener">Ver en FB</a>`
    : '';

  const actions =
    status === 'pending_review' || status === 'draft' || status === 'failed'
      ? `
      <div class="fb-actions">
        <button class="btn" data-act="approve" data-id="${esc(id)}">APROBAR + PUBLICAR</button>
        <button class="btn" data-act="reject" data-id="${esc(id)}">RECHAZAR</button>
        <button class="btn" data-act="save" data-id="${esc(id)}">GUARDAR TEXTO</button>
        ${status === 'failed' || String(post.fb_post_id || '').startsWith('fake_') ? `<button class="btn" data-act="retry" data-id="${esc(id)}">RETRY LIVE</button>` : ''}
      </div>`
      : `<div class="fb-actions">${link}${
          String(post.fb_post_id || '').startsWith('fake_')
            ? ` <button class="btn" data-act="retry" data-id="${esc(id)}">RETRY LIVE</button>`
            : ''
        }</div>`;

  const body = editable
    ? `<textarea class="fb-edit" id="body-${esc(id)}">${esc(post.script_body)}</textarea>`
    : `<div class="fb-body">${esc(post.script_body)}</div>`;

  return `
    <article class="fb-card" data-id="${esc(id)}">
      <h3>${esc(post.topic || post.hook || 'Post')}</h3>
      <p class="fb-meta">${esc(status)} · ${esc(post.trend_source || '—')} · ${esc(post.created_at || '')}</p>
      ${seo}${photo}${err}
      ${body}
      ${actions}
    </article>`;
}

async function loadConfig() {
  const cfg = await api('/api/facebook/config');
  const mode = cfg.effectiveMode || 'manual';
  document.querySelectorAll('input[name="mode"]').forEach((el) => {
    el.checked = el.value === mode;
  });
  cfgPill.textContent = [
    cfg.enabled ? 'ON' : 'OFF',
    mode.toUpperCase(),
    cfg.dryRun ? '⚠ DRY (no sube)' : 'LIVE',
    cfg.configured ? 'TOKEN✓' : 'TOKEN✗',
  ].join(' · ');
  cfgHint.textContent = cfg.dryRun
    ? '⚠ FB_DRY_RUN=true (o el proceso no recargó .env). Pon FB_DRY_RUN=false, guarda, reinicia npm run dev. Los posts "fake_" NO están en Facebook.'
    : cfg.configured
      ? `LIVE · Página ${cfg.pageId} · Graph ${cfg.graphVersion} · modo: ${mode}`
      : 'Falta FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN en .env.';
}

async function loadPosts() {
  const [pending, all] = await Promise.all([
    api('/api/facebook/pending'),
    api('/api/facebook/posts?limit=25'),
  ]);
  const pendingPosts = pending.posts || [];
  pendingList.innerHTML = pendingPosts.length
    ? pendingPosts.map((p) => card(p, { editable: true })).join('')
    : '<p class="hint">Sin pendientes. Dale a GENERAR POST.</p>';

  recentList.innerHTML = (all.posts || [])
    .map((p) => card(p, { editable: p.publish_status === 'pending_review' }))
    .join('') || '<p class="hint">Sin posts aún.</p>';
}

async function refresh() {
  await loadConfig();
  await loadPosts();
}

document.getElementById('refreshBtn').addEventListener('click', () => {
  refresh().catch((e) => alert(e.message));
});

document.getElementById('saveModeBtn').addEventListener('click', async () => {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'manual';
  await api('/api/facebook/config', {
    method: 'POST',
    body: JSON.stringify({ mode, auto_publish: mode === 'auto' }),
  });
  await loadConfig();
  alert(`Modo guardado: ${mode}`);
});

document.getElementById('generateBtn').addEventListener('click', async () => {
  document.getElementById('generateBtn').disabled = true;
  try {
    const out = await api('/api/facebook/generate', { method: 'POST', body: '{}' });
    alert(out.result?.reason || 'Generado');
    await refresh();
  } catch (e) {
    alert(e.message);
  } finally {
    document.getElementById('generateBtn').disabled = false;
  }
});

document.body.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const act = btn.getAttribute('data-act');
  try {
    if (act === 'approve') {
      const out = await api(`/api/facebook/posts/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ by: 'panel' }),
      });
      if (out.dryRun || String(out.post?.fb_post_id || '').startsWith('fake_')) {
        alert(
          '⚠️ Se marcó publicado en DRY-RUN (no salió a Facebook).\n\nPon FB_DRY_RUN=false en .env, reinicia el bot, y usa RETRY en el post.',
        );
      } else {
        alert(
          out.post?.fb_permalink_url
            ? `Publicado en Facebook:\n${out.post.fb_permalink_url}`
            : 'Publicado en Facebook (revisa el muro de la Página).',
        );
      }
    } else if (act === 'reject') {
      const reason = prompt('Motivo del rechazo?', 'No encaja') || 'Rechazado';
      await api(`/api/facebook/posts/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } else if (act === 'retry') {
      await api(`/api/facebook/posts/${id}/retry`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } else if (act === 'save') {
      const ta = document.getElementById(`body-${id}`);
      await api(`/api/facebook/posts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ script_body: ta?.value ?? '' }),
      });
    }
    await refresh();
  } catch (e) {
    alert(e.message);
  }
});

refresh().catch((e) => {
  cfgPill.textContent = 'ERROR';
  pendingList.textContent = e.message;
});
