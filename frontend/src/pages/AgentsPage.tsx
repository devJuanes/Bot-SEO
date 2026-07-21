import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Plus, Settings2 } from 'lucide-react';
import { projectApi } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, LoadingState } from '../components/ui/DataTable';
import { Field, Input, Textarea } from '../components/ui/Input';
import { GateModal, Modal } from '../components/ui/Modal';
import { AgentConfigModal } from '../components/agents/AgentConfigModal';
import { CardListItem, CardTile } from '../components/ui/CardTile';
import { SectionLayout } from '../layout/SectionLayout';
import { useSetup } from '../hooks/useSetup';

interface CatalogAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  added: boolean;
  is_enabled: boolean;
  autopilot_enabled: boolean;
}

interface ProjectAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  is_enabled: boolean;
  autopilot_enabled: boolean;
  config: Record<string, unknown>;
}

interface CustomAgent {
  id: string;
  name: string;
  goal: string;
  system_prompt: string | null;
  schedule_hint: string | null;
  is_enabled: boolean;
  autopilot_enabled: boolean;
  last_run_summary: string | null;
  last_run_status: string | null;
}

export function AgentsPage() {
  const { status, refresh: refreshSetup } = useSetup();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<ProjectAgent[]>([]);
  const [catalog, setCatalog] = useState<CatalogAgent[]>([]);
  const [custom, setCustom] = useState<CustomAgent[]>([]);
  const [contentEnabled, setContentEnabled] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [configAgent, setConfigAgent] = useState<ProjectAgent | null>(null);
  const [gateBrand, setGateBrand] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await projectApi('/agents/full');
      if (!res.ok) throw new Error('No se pudieron cargar los agentes');
      const data = (await res.json()) as {
        agents: ProjectAgent[];
        catalog: CatalogAgent[];
        customAgents: CustomAgent[];
        contentEnabled: boolean;
        brandConfigured: boolean;
      };
      setAgents(data.agents || []);
      setCatalog(data.catalog || []);
      setCustom(data.customAgents || []);
      setContentEnabled(Boolean(data.contentEnabled));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function requireBrand(): boolean {
    if (status && !status.brandConfigured) {
      setGateBrand(true);
      return false;
    }
    return true;
  }

  async function activate(agentId: string) {
    if (!requireBrand()) return;
    setBusy(true);
    try {
      const res = await projectApi('/agents/activate', {
        method: 'POST',
        body: JSON.stringify({ agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al activar');
      setAddOpen(false);
      await load();
      await refreshSetup();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function patchAgent(
    agentId: string,
    patch: { is_enabled?: boolean; autopilot_enabled?: boolean; config?: Record<string, unknown> },
  ) {
    if (!requireBrand() && patch.is_enabled) return;
    setBusy(true);
    try {
      const res = await projectApi(`/agents/${encodeURIComponent(agentId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error');
      }
      setConfigAgent(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createCustom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireBrand()) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await projectApi('/custom-agents', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          goal: form.get('goal'),
          systemPrompt: form.get('systemPrompt') || undefined,
          scheduleHint: form.get('scheduleHint') || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setCustomOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleCustom(id: string, is_enabled: boolean) {
    if (!requireBrand() && is_enabled) return;
    setBusy(true);
    try {
      const res = await projectApi(`/custom-agents/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionLayout
      title="Agentes"
      description="Los agentes trabajan solos al activarse. Solo necesitas pausarlos o reanudarlos."
      icon={Bot}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setCustomOpen(true)}>
            Agente custom
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!requireBrand()) return;
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Añadir agente
          </Button>
        </div>
      }
    >
      {error && (
        <p className="mb-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{error}</p>
      )}

      {/* {!contentEnabled && (
        <p className="mb-4 rounded-2xl border border-border-soft bg-white px-4 py-3 text-sm text-ink-muted">
          Los agentes de blog/contenido están un flag de plan (<code>content_enabled</code>). Contacta a
          MatuByte si los necesitas.
        </p>
      )} */}

      {loading ? (
        <LoadingState label="Cargando agentes…" />
      ) : agents.length === 0 && custom.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No hay agentes"
          description="Añade agentes del catálogo o crea uno personalizado para tu marca."
          action={
            <Button
              onClick={() => {
                if (!requireBrand()) return;
                setAddOpen(true);
              }}
            >
              Añadir agente
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <CardTile
                key={agent.id}
                title={agent.name}
                titleHref={`/agents/${agent.id}`}
                eyebrow={agent.role}
                description={agent.description}
                badges={
                  agent.is_enabled ? (
                    <Badge tone="brand">En ejecución</Badge>
                  ) : (
                    <Badge>Pausado</Badge>
                  )
                }
                footer={
                  <>
                    <Button
                      size="sm"
                      variant={agent.is_enabled ? 'secondary' : 'primary'}
                      onClick={() =>
                        void patchAgent(agent.id, { is_enabled: !agent.is_enabled })
                      }
                      disabled={busy}
                    >
                      {agent.is_enabled ? 'Pausar' : 'Reanudar'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfigAgent(agent)}>
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                }
              />
            ))}
          </div>

          {custom.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">Agentes personalizados</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {custom.map((c) => (
                  <CardTile
                    key={c.id}
                    title={c.name}
                    titleHref={`/agents/custom/${c.id}`}
                    description={c.goal}
                    eyebrow={c.schedule_hint ? `Horario · ${c.schedule_hint}` : 'Agente personalizado'}
                    badges={
                      c.is_enabled ? (
                        <Badge tone="brand">En ejecución</Badge>
                      ) : (
                        <Badge>Pausado</Badge>
                      )
                    }
                    footer={
                      <>
                        <Button
                          size="sm"
                          variant={c.is_enabled ? 'secondary' : 'primary'}
                          onClick={() => void toggleCustom(c.id, !c.is_enabled)}
                          disabled={busy}
                        >
                          {c.is_enabled ? 'Pausar' : 'Reanudar'}
                        </Button>
                        <Link
                          to={`/agents/custom/${c.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-border-soft bg-white px-3.5 text-xs font-medium text-ink transition hover:bg-surface"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </Link>
                      </>
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Añadir agente"
        size="lg"
      >
        <div className="space-y-3">
          {catalog
            .filter((c) => !c.added || !c.is_enabled)
            .map((c) => (
              <CardListItem
                key={c.id}
                title={c.name}
                description={c.description}
                action={
                  <Button size="sm" disabled={busy} onClick={() => void activate(c.id)}>
                    Activar
                  </Button>
                }
              />
            ))}
          {catalog.filter((c) => !c.added || !c.is_enabled).length === 0 && (
            <p className="text-sm text-ink-muted">Todos los agentes del catálogo ya están añadidos.</p>
          )}
        </div>
      </Modal>

      <Modal open={customOpen} onClose={() => setCustomOpen(false)} title="Crear agente personalizado">
        <form onSubmit={createCustom} className="space-y-3">
          <Field>
            <label className="mb-1 block text-sm font-medium">Nombre</label>
            <Input name="name" required placeholder="Ej. Cazador apps facturación" />
          </Field>
          <Field>
            <label className="mb-1 block text-sm font-medium">Objetivo / prompt</label>
            <Textarea name="goal" required rows={4} placeholder="Qué debe lograr este agente…" />
          </Field>
          <Field>
            <label className="mb-1 block text-sm font-medium">System prompt (opcional)</label>
            <Textarea name="systemPrompt" rows={3} />
          </Field>
          <Field>
            <label className="mb-1 block text-sm font-medium">Horario / frecuencia (texto)</label>
            <Input name="scheduleHint" placeholder="Ej. cada mañana, semanal…" />
          </Field>
          <p className="text-xs text-ink-muted">
            Limitación: los agentes custom se ejecutan vía LLM con el contexto de marca; aún no
            tienen scrapers propios.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCustomOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              Crear
            </Button>
          </div>
        </form>
      </Modal>

      <AgentConfigModal
        agent={configAgent}
        setup={status}
        open={Boolean(configAgent)}
        busy={busy}
        onClose={() => setConfigAgent(null)}
      />

      <GateModal
        open={gateBrand}
        onClose={() => setGateBrand(false)}
        title="Marca no configurada"
        message="Debes configurar tu marca antes de activar o ejecutar agentes."
        ctaLabel="Ir a configuración"
        ctaTo="/setup"
      />
    </SectionLayout>
  );
}
