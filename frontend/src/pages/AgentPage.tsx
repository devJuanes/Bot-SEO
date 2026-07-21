import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, Pause, Play } from 'lucide-react';
import { api, projectApi } from '../api/client';
import { AgentChatPanel } from '../components/agents/AgentChatPanel';
import { AgentDetailPanel } from '../components/agents/AgentDetailPanel';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities?: string[];
}

interface RuntimeInfo {
  status?: string;
}

export function AgentPage({ variant = 'catalog' }: { variant?: 'catalog' | 'custom' }) {
  const { id: agentId } = useParams<{ id: string }>();
  const sessionId =
    variant === 'custom' ? `ui-custom-${agentId || 'unknown'}` : `ui-${agentId || 'unknown'}`;
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [running, setRunning] = useState(true);
  const [runtime, setRuntime] = useState<RuntimeInfo>({});
  const [busy, setBusy] = useState(false);

  const loadMeta = useCallback(async () => {
    if (!agentId) return;

    if (variant === 'custom') {
      const res = await projectApi(`/custom-agents/${encodeURIComponent(agentId)}/insights`);
      const data = await res.json();
      if (!res.ok) {
        setAgent({
          id: agentId,
          name: data.error || 'Error',
          role: '',
          description: '',
        });
        return;
      }
      const info = data.agent as {
        id: string;
        name: string;
        role: string;
        description: string;
        capabilities?: string[];
      };
      setAgent({
        id: info.id,
        name: info.name,
        role: info.role === 'custom' ? 'Agente personalizado' : info.role,
        description: info.description,
        capabilities: info.capabilities,
      });
      setRuntime({});
      setRunning(Boolean(data.is_enabled));
      return;
    }

    const [detailRes, fullRes] = await Promise.all([
      api(`/api/agents/${encodeURIComponent(agentId)}`),
      projectApi('/agents/full'),
    ]);
    const detail = await detailRes.json();
    const full = fullRes.ok ? await fullRes.json() : { agents: [] };
    const projectAgent = (full.agents as Array<{ id: string; is_enabled: boolean }>).find(
      (a) => a.id === agentId,
    );

    if (!detailRes.ok) {
      setAgent({ id: agentId, name: detail.error || 'Error', role: '', description: '' });
      return;
    }
    setAgent(detail.agent);
    setRuntime(detail.runtime || {});
    setRunning(projectAgent?.is_enabled ?? true);
  }, [agentId, variant]);

  useEffect(() => {
    void loadMeta();
    const t = setInterval(() => void loadMeta(), 12000);
    return () => clearInterval(t);
  }, [loadMeta]);

  async function togglePause() {
    if (!agentId) return;
    setBusy(true);
    try {
      const next = !running;
      const res =
        variant === 'custom'
          ? await projectApi(`/custom-agents/${encodeURIComponent(agentId)}`, {
              method: 'PATCH',
              body: JSON.stringify({ is_enabled: next }),
            })
          : await projectApi(`/agents/${encodeURIComponent(agentId)}`, {
              method: 'PATCH',
              body: JSON.stringify({ is_enabled: next }),
            });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'No se pudo actualizar');
      }
      setRunning(next);
      await loadMeta();
    } finally {
      setBusy(false);
    }
  }

  const statusLabel =
    runtime.status === 'running' ? 'Procesando' : running ? 'En ejecución' : 'Pausado';

  const statusTone =
    runtime.status === 'running' ? 'success' : running ? 'brand' : 'default';

  return (
    <div className="flex h-[calc(100dvh-3.75rem)] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border-soft bg-surface px-5 py-4 lg:px-6">
        <Link
          to="/agentes"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a agentes
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Bot className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-ink lg:text-2xl">
                {agent?.name || agentId}
              </h1>
              {agent?.role && (
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  {agent.role}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            <Button
              size="sm"
              variant={running ? 'secondary' : 'primary'}
              disabled={busy}
              onClick={() => void togglePause()}
            >
              {running ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Reanudar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:p-5">
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <Card>
            <CardBody className="space-y-3 p-5">
              <p className="text-sm leading-relaxed text-ink-muted">
                {agent?.description || '—'}
              </p>
              {agent?.capabilities && agent.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {agent.capabilities.map((cap) => (
                    <Badge key={cap}>{cap}</Badge>
                  ))}
                </div>
              )}
              {!running && (
                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  El agente está pausado. Reanúdalo para que vuelva a trabajar en segundo plano.
                </p>
              )}
            </CardBody>
          </Card>

          {agentId ? (
            <AgentDetailPanel agentId={agentId} variant={variant} />
          ) : null}
        </div>

        {agentId ? (
          <AgentChatPanel
            agentId={agentId}
            sessionId={sessionId}
            variant={variant}
            className="min-h-[320px] lg:min-h-0 lg:h-full"
          />
        ) : null}
      </div>
    </div>
  );
}
