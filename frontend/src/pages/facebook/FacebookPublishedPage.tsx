import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { apiJson } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState } from '../../components/ui/DataTable';
import { SectionLayout } from '../../layout/SectionLayout';
import { FacebookPostCard, type FbPost, mediaType } from './FacebookPostCard';

const FB_TABS = [
  { to: '/facebook/queue', label: 'Cola de publicación' },
  { to: '/facebook/published', label: 'Publicados' },
  { to: '/facebook/generate', label: 'Generar contenido' },
];

export function FacebookPublishedPage() {
  const navigate = useNavigate();
  const [configured, setConfigured] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [posts, setPosts] = useState<FbPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await apiJson<{ configured: boolean; dryRun: boolean }>(
        '/api/facebook/config',
      );
      setConfigured(cfg.configured);
      setDryRun(cfg.dryRun);
      const all = await apiJson<{ posts: FbPost[] }>('/api/facebook/posts?limit=50');
      const published = (all.posts || []).filter(
        (p) => p.publish_status === 'published' || Boolean(p.fb_permalink_url),
      );
      setPosts(published);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SectionLayout
      title="Facebook"
      description="Historial de posts publicados en tu página."
      icon={Share2}
      tabs={FB_TABS}
    >
      {loading ? (
        <LoadingState />
      ) : !configured && !dryRun ? (
        <EmptyState
          icon={Share2}
          title="Facebook no configurado"
          description="Configura Page ID y Page Access Token en Ajustes → Facebook para ver publicaciones reales."
          action={
            <Button onClick={() => navigate('/settings/facebook')}>Ir a ajustes</Button>
          }
        />
      ) : posts.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay posts publicados.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <FacebookPostCard
              key={p.id}
              post={p}
              editable={false}
              body={p.script_body}
              onBodyChange={() => undefined}
              media={{ url: p.fb_photo_url || '', kind: mediaType(p) }}
              onMediaChange={() => undefined}
              onAction={() => undefined}
            />
          ))}
        </div>
      )}
    </SectionLayout>
  );
}
