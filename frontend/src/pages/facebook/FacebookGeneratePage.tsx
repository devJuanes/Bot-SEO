import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Sparkles } from 'lucide-react';
import { apiJson, projectApi } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/DataTable';
import { GateModal, Modal } from '../../components/ui/Modal';
import { SectionLayout } from '../../layout/SectionLayout';
import { useSetup } from '../../hooks/useSetup';

const FB_TABS = [
  { to: '/facebook/queue', label: 'Cola de publicación' },
  { to: '/facebook/published', label: 'Publicados' },
  { to: '/facebook/generate', label: 'Generar contenido' },
];

export function FacebookGeneratePage() {
  const navigate = useNavigate();
  const { status } = useSetup();
  const [configured, setConfigured] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [mode, setMode] = useState('manual');
  const [generating, setGenerating] = useState(false);
  const [hint, setHint] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [resultModal, setResultModal] = useState('');
  const [errorModal, setErrorModal] = useState('');
  const [gateFb, setGateFb] = useState(false);

  const load = useCallback(async () => {
    const cfg = await apiJson<{
      configured: boolean;
      dryRun: boolean;
      effectiveMode?: string;
      pageId?: string;
    }>('/api/facebook/config');
    setConfigured(cfg.configured);
    setDryRun(cfg.dryRun);
    setMode(cfg.effectiveMode || 'manual');
    setHint(
      cfg.dryRun
        ? 'Modo dry-run activo: los posts no se publican en Facebook real.'
        : cfg.configured
          ? 'Facebook configurado y listo para generar contenido.'
          : 'Configura Facebook en Ajustes antes de generar.',
    );
    try {
      const res = await projectApi('/settings');
      const data = (await res.json()) as { settings?: Record<string, unknown> };
      const prompt = data.settings?.facebook_custom_prompt;
      if (typeof prompt === 'string') setCustomPrompt(prompt);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMode() {
    await apiJson('/api/facebook/config', {
      method: 'POST',
      body: JSON.stringify({ mode, auto_publish: mode === 'auto' }),
    });
    await load();
  }

  async function savePrompt() {
    await projectApi('/settings/facebook_custom_prompt', {
      method: 'PUT',
      body: JSON.stringify({ value: customPrompt }),
    });
    setResultModal('Brief personalizado guardado.');
  }

  async function generate() {
    if (status && !status.facebookConfigured) {
      setGateFb(true);
      return;
    }
    setGenerating(true);
    try {
      const out = await apiJson<{ result?: { reason?: string; status?: string } }>(
        '/api/facebook/generate',
        {
          method: 'POST',
          body: JSON.stringify({ customPrompt, savePrompt: true }),
        },
      );
      setResultModal(
        out.result?.reason ||
          'Post generado. Revisa la cola de publicación.',
      );
    } catch (e) {
      setErrorModal(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <SectionLayout
      title="Facebook"
      description="Genera contenido con IA y configura el modo de publicación."
      icon={Share2}
      tabs={FB_TABS}
    >
      {!configured && !dryRun ? (
        <EmptyState
          icon={Share2}
          title="Facebook no configurado"
          description="Conecta tu página de Facebook en Ajustes para generar y publicar contenido real."
          action={
            <Button onClick={() => navigate('/settings/facebook')}>Ir a ajustes</Button>
          }
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-600" />
              <h2 className="font-semibold text-slate-900">Generar post</h2>
            </div>
            <p className="text-sm text-slate-500">{hint}</p>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Brief / prompt personalizado</label>
              <Textarea
                rows={5}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ej. Enfócate en facturación electrónica para pymes en Cali…"
              />
              <p className="mt-1 text-xs text-ink-muted">
                Se guarda en ajustes del proyecto y se envía al generador.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void savePrompt()}>
                Guardar brief
              </Button>
              <Button onClick={() => void generate()} loading={generating}>
                Generar post con IA
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-semibold text-slate-900">Modo de publicación</h2>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <input
                type="radio"
                name="mode"
                checked={mode === 'manual'}
                onChange={() => setMode('manual')}
              />
              <span className="text-sm">Manual — apruebo en la cola</span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <input
                type="radio"
                name="mode"
                checked={mode === 'auto'}
                onChange={() => setMode('auto')}
              />
              <span className="text-sm">Auto — publica al generar</span>
            </label>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => void saveMode()}>
                Guardar modo
              </Button>
              <Badge tone="brand">{mode.toUpperCase()}</Badge>
            </div>
          </CardBody>
        </Card>
      </div>
      )}

      <Modal open={Boolean(resultModal)} onClose={() => setResultModal('')} title="Resultado">
        <p className="text-sm text-ink-muted">{resultModal}</p>
      </Modal>
      <Modal open={Boolean(errorModal)} onClose={() => setErrorModal('')} title="Error">
        <p className="text-sm text-ink-muted">{errorModal}</p>
      </Modal>
      <GateModal
        open={gateFb}
        onClose={() => setGateFb(false)}
        title="Facebook no configurado"
        message="Configura Page ID y Access Token en Ajustes → Facebook antes de generar o publicar."
        ctaLabel="Ir a Facebook"
        ctaTo="/settings/facebook"
      />
    </SectionLayout>
  );
}
