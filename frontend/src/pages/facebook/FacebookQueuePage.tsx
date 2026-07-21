import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { apiJson } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { EmptyState, LoadingState } from '../../components/ui/DataTable';
import { Field, Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SectionLayout } from '../../layout/SectionLayout';
import { FacebookPostCard, type FbPost, mediaType } from './FacebookPostCard';

const FB_TABS = [
  { to: '/facebook/queue', label: 'Cola de publicación' },
  { to: '/facebook/published', label: 'Publicados' },
  { to: '/facebook/generate', label: 'Generar contenido' },
];

export function FacebookQueuePage() {
  const navigate = useNavigate();
  const [configured, setConfigured] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [pending, setPending] = useState<FbPost[]>([]);
  const [configLabel, setConfigLabel] = useState('…');
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mediaDrafts, setMediaDrafts] = useState<
    Record<string, { url: string; kind: string; status?: string }>
  >({});
  const [errorModal, setErrorModal] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('No encaja');
  const [rejecting, setRejecting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await apiJson<{
        configured: boolean;
        enabled: boolean;
        dryRun: boolean;
        effectiveMode?: string;
      }>('/api/facebook/config');
      setConfigured(cfg.configured);
      setDryRun(cfg.dryRun);
      setConfigLabel(
        [cfg.enabled ? 'ON' : 'OFF', (cfg.effectiveMode || 'manual').toUpperCase(), cfg.dryRun ? 'DRY' : 'LIVE'].join(' · '),
      );
      const pend = await apiJson<{ posts: FbPost[] }>('/api/facebook/pending');
      setPending(pend.posts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function confirmReject() {
    if (!rejectId) return;
    setRejecting(true);
    try {
      await apiJson(`/api/facebook/posts/${rejectId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() || 'Rechazado' }),
      });
      setRejectId(null);
      setRejectReason('No encaja');
      await refresh();
    } catch (e) {
      setErrorModal(e instanceof Error ? e.message : String(e));
    } finally {
      setRejecting(false);
    }
  }

  async function act(id: string, action: string) {
    try {
      if (action === 'approve') {
        await apiJson(`/api/facebook/posts/${id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ by: 'panel' }),
        });
      } else if (action === 'reject') {
        setRejectReason('No encaja');
        setRejectId(id);
        return;
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
      } else if (action === 'retry') {
        await apiJson(`/api/facebook/posts/${id}/retry`, { method: 'POST', body: JSON.stringify({}) });
      }
      await refresh();
    } catch (e) {
      setErrorModal(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SectionLayout
      title="Facebook"
      description="Revisa, edita y aprueba posts antes de publicar en tu página."
      icon={Share2}
      tabs={FB_TABS}
      actions={
        <>
          <Badge tone={configured ? 'success' : 'warning'}>
            {configured ? 'Meta conectado' : 'Sin configurar'}
          </Badge>
          <Badge tone="brand">{configLabel}</Badge>
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>
            Actualizar
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingState />
      ) : !configured && !dryRun ? (
        <EmptyState
          icon={Share2}
          title="Facebook no configurado"
          description="Añade Page ID y Page Access Token en Ajustes → Facebook para publicar en tu página."
          action={
            <Button onClick={() => navigate('/settings/facebook')}>Ir a ajustes</Button>
          }
        />
      ) : pending.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-slate-500">
            Sin posts pendientes. Ve a Generar contenido para crear uno nuevo.
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((p) => (
            <FacebookPostCard
              key={p.id}
              post={p}
              editable
              body={drafts[p.id] ?? p.script_body}
              onBodyChange={(v) => setDrafts((d) => ({ ...d, [p.id]: v }))}
              media={
                mediaDrafts[p.id] ?? { url: p.fb_photo_url || '', kind: mediaType(p) }
              }
              onMediaChange={(m) => setMediaDrafts((d) => ({ ...d, [p.id]: m }))}
              onAction={(a) => void act(p.id, a)}
            />
          ))}
        </div>
      )}

      <Modal
        open={Boolean(rejectId)}
        onClose={() => {
          if (!rejecting) setRejectId(null);
        }}
        title="Rechazar post"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectId(null)} disabled={rejecting}>
              Cancelar
            </Button>
            <Button
              onClick={() => void confirmReject()}
              disabled={rejecting}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejecting ? '…' : 'Rechazar'}
            </Button>
          </>
        }
      >
        <Field>
          <label className="mb-1.5 block text-sm font-medium">Motivo del rechazo</label>
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="No encaja"
            autoFocus
          />
        </Field>
      </Modal>

      <Modal open={Boolean(errorModal)} onClose={() => setErrorModal('')} title="Error">
        <p className="text-sm text-ink-muted">{errorModal}</p>
      </Modal>
    </SectionLayout>
  );
}
