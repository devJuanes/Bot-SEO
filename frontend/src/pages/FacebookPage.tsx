import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../api/client';

interface FbPost {
  id: string;
  topic?: string;
  hook?: string;
  script_body: string;
  publish_status?: string;
  trend_source?: string;
  created_at?: string;
  seo_title?: string;
  error_message?: string;
  fb_permalink_url?: string;
  fb_photo_url?: string;
  fb_post_id?: string;
  metadata?: { media_type?: string; media_thumb?: string };
}

interface FbConfig {
  configured: boolean;
  enabled: boolean;
  dryRun: boolean;
  effectiveMode?: string;
  graphVersion?: string;
  pageId?: string;
}

function mediaType(post: FbPost): 'video' | 'image' | 'none' {
  const meta = post.metadata && typeof post.metadata === 'object' ? post.metadata : {};
  if (
    meta.media_type === 'video' ||
    /\.(mp4|mov|webm)(\?|$)/i.test(String(post.fb_photo_url || ''))
  ) {
    return 'video';
  }
  return post.fb_photo_url ? 'image' : 'none';
}

export function FacebookPage() {
  const [config, setConfig] = useState<FbConfig | null>(null);
  const [pageName, setPageName] = useState<string | null>(null);
  const [pending, setPending] = useState<FbPost[]>([]);
  const [recent, setRecent] = useState<FbPost[]>([]);
  const [mode, setMode] = useState('manual');
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mediaDrafts, setMediaDrafts] = useState<
    Record<string, { url: string; kind: string; status?: string }>
  >({});

  const refresh = useCallback(async () => {
    const cfg = await apiJson<FbConfig>('/api/facebook/config');
    setConfig(cfg);
    setMode(cfg.effectiveMode || 'manual');

    if (cfg.configured) {
      try {
        const diag = await apiJson<{ page?: { name: string; id: string } }>('/api/facebook/diagnostics');
        setPageName(diag.page?.name ?? null);
      } catch {
        setPageName(null);
      }
    }

    const [pend, all] = await Promise.all([
      apiJson<{ posts: FbPost[] }>('/api/facebook/pending'),
      apiJson<{ posts: FbPost[] }>('/api/facebook/posts?limit=25'),
    ]);
    setPending(pend.posts || []);
    setRecent(all.posts || []);
  }, []);

  useEffect(() => {
    refresh().catch((e) => alert(e instanceof Error ? e.message : String(e)));
  }, [refresh]);

  async function saveMode() {
    await apiJson('/api/facebook/config', {
      method: 'POST',
      body: JSON.stringify({ mode, auto_publish: mode === 'auto' }),
    });
    await refresh();
    alert(`Modo guardado: ${mode}`);
  }

  async function generate() {
    setGenerating(true);
    try {
      const out = await apiJson<{ result?: { reason?: string } }>('/api/facebook/generate', {
        method: 'POST',
        body: '{}',
      });
      alert(out.result?.reason || 'Generado');
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function act(id: string, action: string) {
    try {
      if (action === 'approve') {
        const out = await apiJson<{ dryRun?: boolean; post?: FbPost }>(
          `/api/facebook/posts/${id}/approve`,
          { method: 'POST', body: JSON.stringify({ by: 'panel' }) },
        );
        if (out.dryRun || String(out.post?.fb_post_id || '').startsWith('fake_')) {
          alert(
            'Publicado en modo dry-run (no salió a Facebook). Desactiva dry-run en Ajustes y usa RETRY.',
          );
        } else {
          alert(
            out.post?.fb_permalink_url
              ? `Publicado en Facebook:\n${out.post.fb_permalink_url}`
              : 'Publicado en Facebook (revisa el muro de la Página).',
          );
        }
      } else if (action === 'reject') {
        const reason = prompt('Motivo del rechazo?', 'No encaja') || 'Rechazado';
        await apiJson(`/api/facebook/posts/${id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
      } else if (action === 'retry') {
        await apiJson(`/api/facebook/posts/${id}/retry`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      } else if (action === 'save') {
        await apiJson(`/api/facebook/posts/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ script_body: drafts[id] ?? '' }),
        });
      } else if (action === 'save-media') {
        const m = mediaDrafts[id];
        await apiJson(`/api/facebook/posts/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fb_photo_url: m?.kind === 'none' ? null : m?.url || null,
            media_type: m?.kind || 'none',
          }),
        });
      } else if (action === 'upload-media') {
        const input = document.getElementById(`media-file-${id}`) as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) throw new Error('Selecciona una imagen o video');
        const form = new FormData();
        form.append('media', file);
        await apiJson(`/api/facebook/posts/${id}/media`, { method: 'POST', body: form });
      } else if (action === 'remove-media') {
        await apiJson(`/api/facebook/posts/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ fb_photo_url: null, media_type: 'none' }),
        });
      }
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  const cfgLabel = config
    ? [
        config.enabled ? 'ON' : 'OFF',
        (config.effectiveMode || mode).toUpperCase(),
        config.dryRun ? 'DRY' : 'LIVE',
        config.configured && pageName ? 'TOKEN✓' : 'TOKEN✗',
      ].join(' · ')
    : '…';

  const cfgHint = config?.dryRun
    ? 'Modo dry-run activo: los posts no se publican en Facebook. Desactívalo en Ajustes.'
    : config?.configured
      ? pageName
        ? `LIVE · ${pageName} · Graph ${config.graphVersion} · modo: ${config.effectiveMode}`
        : `Token inválido o expirado · Página ${config.pageId}. Actualiza en Ajustes.`
      : 'Facebook no configurado. Ve a Ajustes del proyecto.';

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="page-title">Facebook</h1>
          <p className="page-subtitle">Cola de publicación</p>
        </div>
        <div className="topbar-right">
          <span className="status-badge muted">{cfgLabel}</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={generating} onClick={() => void generate()}>
            {generating ? '…' : 'Generar post'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void refresh()}>
            Actualizar
          </button>
        </div>
      </header>

      <main className="content-area">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Modo publicación</h2>
              <p className="panel-desc">{cfgHint}</p>
            </div>
          </div>
          <div className="mode-row">
            <label className="field-check">
              <input
                type="radio"
                name="mode"
                value="manual"
                checked={mode === 'manual'}
                onChange={() => setMode('manual')}
              />
              <span>Manual (yo apruebo en esta cola)</span>
            </label>
            <label className="field-check">
              <input
                type="radio"
                name="mode"
                value="auto"
                checked={mode === 'auto'}
                onChange={() => setMode('auto')}
              />
              <span>Auto (publica solo al generar)</span>
            </label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void saveMode()}>
              Guardar modo
            </button>
          </div>
        </section>

        <section className="grid-2">
          <div className="panel">
            <div className="panel-header"><h2>Pendientes</h2></div>
            {pending.length === 0 ? (
              <p className="hint">Sin pendientes. Dale a Generar post.</p>
            ) : (
              pending.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  editable
                  body={drafts[p.id] ?? p.script_body}
                  onBodyChange={(v) => setDrafts((d) => ({ ...d, [p.id]: v }))}
                  media={mediaDrafts[p.id] ?? {
                    url: p.fb_photo_url || '',
                    kind: mediaType(p),
                  }}
                  onMediaChange={(m) => setMediaDrafts((d) => ({ ...d, [p.id]: m }))}
                  onAction={(a) => void act(p.id, a)}
                />
              ))
            )}
          </div>
          <div className="panel">
            <div className="panel-header"><h2>Recientes</h2></div>
            {recent.length === 0 ? (
              <p className="hint">Sin posts aún.</p>
            ) : (
              recent.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  editable={p.publish_status === 'pending_review'}
                  body={drafts[p.id] ?? p.script_body}
                  onBodyChange={(v) => setDrafts((d) => ({ ...d, [p.id]: v }))}
                  media={mediaDrafts[p.id] ?? {
                    url: p.fb_photo_url || '',
                    kind: mediaType(p),
                  }}
                  onMediaChange={(m) => setMediaDrafts((d) => ({ ...d, [p.id]: m }))}
                  onAction={(a) => void act(p.id, a)}
                />
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function PostCard({
  post,
  editable,
  body,
  onBodyChange,
  media,
  onMediaChange,
  onAction,
}: {
  post: FbPost;
  editable: boolean;
  body: string;
  onBodyChange: (v: string) => void;
  media: { url: string; kind: string; status?: string };
  onMediaChange: (m: { url: string; kind: string; status?: string }) => void;
  onAction: (action: string) => void;
}) {
  const status = post.publish_status || 'draft';
  const kind = media.kind as 'video' | 'image' | 'none';
  const showActions =
    status === 'pending_review' || status === 'draft' || status === 'failed';

  return (
    <article className="fb-card">
      <h3>{post.topic || post.hook || 'Post'}</h3>
      <p className="fb-meta">
        {status} · {post.trend_source || '—'} · {post.created_at || ''}
      </p>
      {post.seo_title && <p className="fb-meta">SEO: {post.seo_title}</p>}
      {kind === 'video' && post.fb_photo_url && (
        <video src={post.fb_photo_url} controls muted playsInline className="fb-media" />
      )}
      {kind === 'image' && post.fb_photo_url && (
        <img src={post.fb_photo_url} alt="" className="fb-media" />
      )}
      {post.error_message && <p className="fb-error">⚠ {post.error_message}</p>}

      {editable && (
        <div className="fb-media-editor">
          <input
            type="url"
            value={media.url}
            placeholder="https://... imagen o video"
            onChange={(e) => onMediaChange({ ...media, url: e.target.value })}
          />
          <select
            value={media.kind}
            onChange={(e) => onMediaChange({ ...media, kind: e.target.value })}
          >
            <option value="image">Imagen</option>
            <option value="video">Video</option>
            <option value="none">Sin medio</option>
          </select>
          <input
            type="file"
            id={`media-file-${post.id}`}
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          />
          <span className="media-status">
            {media.status || 'Puedes pegar una URL o cargar un archivo (máx. 100 MB).'}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAction('save-media')}>
            Guardar URL
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAction('upload-media')}>
            Subir archivo
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAction('remove-media')}>
            Quitar medio
          </button>
        </div>
      )}

      {editable ? (
        <textarea className="fb-edit" value={body} onChange={(e) => onBodyChange(e.target.value)} />
      ) : (
        <div className="fb-body">{post.script_body}</div>
      )}

      {showActions ? (
        <div className="fb-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onAction('approve')}>
            Aprobar + publicar
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAction('reject')}>
            Rechazar
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAction('save')}>
            Guardar texto
          </button>
          {(status === 'failed' || String(post.fb_post_id || '').startsWith('fake_')) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAction('retry')}>
              Retry live
            </button>
          )}
        </div>
      ) : (
        <div className="fb-actions">
          {post.fb_permalink_url && (
            <a href={post.fb_permalink_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              Ver en FB
            </a>
          )}
          {String(post.fb_post_id || '').startsWith('fake_') && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAction('retry')}>
              Retry live
            </button>
          )}
        </div>
      )}
    </article>
  );
}
