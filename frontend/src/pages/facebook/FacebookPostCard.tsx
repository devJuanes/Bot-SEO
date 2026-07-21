import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { CardEntityHeader } from '../../components/ui/CardTile';
import { Textarea } from '../../components/ui/Input';

export interface FbPost {
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

export function mediaType(post: FbPost): 'video' | 'image' | 'none' {
  const meta = post.metadata && typeof post.metadata === 'object' ? post.metadata : {};
  if (
    meta.media_type === 'video' ||
    /\.(mp4|mov|webm)(\?|$)/i.test(String(post.fb_photo_url || ''))
  ) {
    return 'video';
  }
  return post.fb_photo_url ? 'image' : 'none';
}

export function FacebookPostCard({
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
    <Card>
      <CardBody className="space-y-4">
        <CardEntityHeader
          as="h3"
          title={post.topic || post.hook || 'Post'}
          titleClassName="text-lg"
          subtitle={
            <>
              {post.trend_source || '—'} ·{' '}
              {post.created_at ? new Date(post.created_at).toLocaleString() : '—'}
            </>
          }
          subtitleClassName="text-xs"
          badges={<Badge tone={status === 'published' ? 'success' : 'brand'}>{status}</Badge>}
        />

        {kind === 'video' && post.fb_photo_url && (
          <video src={post.fb_photo_url} controls muted playsInline className="max-h-64 rounded-xl" />
        )}
        {kind === 'image' && post.fb_photo_url && (
          <img src={post.fb_photo_url} alt="" className="max-h-64 rounded-xl object-cover" />
        )}
        {post.error_message && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{post.error_message}</p>
        )}

        {editable && (
          <div className="grid gap-2 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
            <input
              type="url"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={media.url}
              placeholder="https://... imagen o video"
              onChange={(e) => onMediaChange({ ...media, url: e.target.value })}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
              className="text-sm md:col-span-2"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            />
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button size="sm" variant="secondary" onClick={() => onAction('save-media')}>
                Guardar URL
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onAction('upload-media')}>
                Subir archivo
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onAction('remove-media')}>
                Quitar medio
              </Button>
            </div>
          </div>
        )}

        {editable ? (
          <Textarea value={body} onChange={(e) => onBodyChange(e.target.value)} rows={6} />
        ) : (
          <div className="whitespace-pre-wrap text-sm text-slate-700">{post.script_body}</div>
        )}

        {showActions ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onAction('approve')}>
              Aprobar + publicar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onAction('reject')}>
              Rechazar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onAction('save')}>
              Guardar texto
            </Button>
            {(status === 'failed' || String(post.fb_post_id || '').startsWith('fake_')) && (
              <Button size="sm" variant="secondary" onClick={() => onAction('retry')}>
                Retry live
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {post.fb_permalink_url && (
              <a
                href={post.fb_permalink_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Ver en Facebook
              </a>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
