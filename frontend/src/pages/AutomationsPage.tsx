import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Plus, Save, Workflow } from 'lucide-react';
import { apiJson } from '../api/client';
import { AutomationFlowCanvas } from '../components/automations/AutomationFlowCanvas';
import { FlowListItem } from '../components/automations/FlowListItem';
import { FlowNodeInspector } from '../components/automations/FlowNodeInspector';
import { FlowPalette } from '../components/automations/FlowPalette';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { LoadingState } from '../components/ui/DataTable';
import { SectionLayout } from '../layout/SectionLayout';
import {
  ACTION_OPTIONS,
  defaultFlow,
  newNodeId,
  ruleToFlow,
  triggerLabel,
  type AutomationFlow,
  type AutomationRule,
  type FlowNode,
} from '../lib/automation-flow';

export function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [name, setName] = useState('Nuevo flujo');
  const [enabled, setEnabled] = useState(true);
  const [flow, setFlow] = useState<AutomationFlow>(defaultFlow());
  const [flowKey, setFlowKey] = useState('new');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('trigger-1');

  const isDraft = draftId !== null;
  const selectedRule = rules.find((r) => r.id === selectedId) ?? null;
  const triggerNode = flow.nodes.find((n) => n.type === 'trigger') ?? null;
  const selectedNode =
    flow.nodes.find((n) => n.id === selectedNodeId) ??
    triggerNode ??
    flow.nodes[0] ??
    null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiJson<{ rules: AutomationRule[] }>('/api/automations');
      setRules(res.rules ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNewFlow(seed?: { flow: AutomationFlow; name: string }) {
    setSelectedId(null);
    setDraftId(`draft-${Date.now()}`);
    setName(seed?.name ?? 'Nuevo flujo');
    setEnabled(true);
    setFlow(seed?.flow ?? defaultFlow());
    setFlowKey(`new-${Date.now()}`);
    setSelectedNodeId('trigger-1');
    setError('');
  }

  function openRule(rule: AutomationRule) {
    setDraftId(null);
    setSelectedId(rule.id);
    setName(rule.name);
    setEnabled(rule.is_enabled);
    setFlow(ruleToFlow(rule));
    setFlowKey(rule.id);
    setSelectedNodeId('trigger-1');
    setError('');
  }

  function updateNodeData(nodeId: string, data: FlowNode['data']) {
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, data } : n)),
    }));
  }

  function setTriggerType(triggerId: string) {
    const trigger = flow.nodes.find((n) => n.type === 'trigger');
    if (!trigger) return;
    updateNodeData(trigger.id, {
      ...trigger.data,
      triggerType: triggerId,
      label: triggerLabel(triggerId),
      triggerConfig: {},
    });
    setSelectedNodeId(trigger.id);
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    const node = flow.nodes.find((n) => n.id === selectedNodeId);
    if (!node || node.type === 'trigger') return;

    setFlow((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== selectedNodeId),
      edges: prev.edges.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
      ),
    }));
    setSelectedNodeId(triggerNode?.id ?? null);
  }

  function addNode(type: 'filter' | 'action', actionId?: string) {
    const id = newNodeId(type, flow.nodes);
    const last = flow.nodes[flow.nodes.length - 1];
    const x = (last?.position.x ?? 40) + 260;
    const y = last?.position.y ?? 140;

    let node: FlowNode;
    if (type === 'filter') {
      node = {
        id,
        type: 'filter',
        position: { x, y },
        data: {
          label: 'Filtro',
          condition: { field: 'needs_website', op: 'truthy' },
        },
      };
    } else {
      const opt = ACTION_OPTIONS.find((o) => o.id === actionId) ?? ACTION_OPTIONS[0];
      node = {
        id,
        type: 'action',
        position: { x, y },
        data: {
          label: opt.label,
          actionType: opt.id,
          actionConfig: { ...opt.defaults },
        },
      };
    }

    const edge = last
      ? [{ id: `e-${last.id}-${id}`, source: last.id, target: id }]
      : [];

    setFlow((prev) => ({
      nodes: [...prev.nodes, node],
      edges: [...prev.edges, ...edge],
    }));
    setSelectedNodeId(id);
  }

  async function saveFlow() {
    setSaving(true);
    setError('');
    try {
      const body = { name: name.trim() || 'Flujo sin nombre', is_enabled: enabled, flow };
      if (isDraft) {
        const res = await apiJson<{ rule: AutomationRule }>('/api/automations', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setDraftId(null);
        setSelectedId(res.rule.id);
        setFlowKey(res.rule.id);
        await load();
      } else if (selectedId) {
        await apiJson(`/api/automations/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: AutomationRule) {
    await apiJson(`/api/automations/${rule.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_enabled: !rule.is_enabled }),
    });
    if (selectedId === rule.id) setEnabled(!rule.is_enabled);
    await load();
  }

  function duplicateRule(rule: AutomationRule) {
    openNewFlow({ flow: ruleToFlow(rule), name: `${rule.name} (copia)` });
  }

  async function deleteRule(rule: AutomationRule) {
    if (!confirm(`¿Eliminar el flujo "${rule.name}"?`)) return;
    await apiJson(`/api/automations/${rule.id}`, { method: 'DELETE' });
    if (selectedId === rule.id) {
      setSelectedId(null);
      setDraftId(null);
      setFlow(defaultFlow());
      setFlowKey('deleted');
      setSelectedNodeId(null);
    }
    await load();
  }

  const showEditor = isDraft || selectedId !== null;

  return (
    <SectionLayout
      title="Flujos"
      description="Automatiza con disparadores, filtros y acciones."
      icon={Workflow}
      actions={
        <div className="flex gap-2">
          <Button size="sm" onClick={() => openNewFlow()}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo flujo
          </Button>
          <Link to="/monitor">
            <Button size="sm" variant="secondary">
              <Bot className="mr-1.5 h-4 w-4" />
              Monitor
            </Button>
          </Link>
        </div>
      }
    >
      {error ? (
        <p className="mb-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-[calc(100vh-12rem)] gap-4">
        <aside className="flex w-56 shrink-0 flex-col gap-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Mis flujos
          </p>
          {loading ? (
            <LoadingState compact label="Cargando…" />
          ) : (
            <>
              {isDraft ? (
                <div className="rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
                  {name} <Badge tone="brand">Borrador</Badge>
                </div>
              ) : null}
              {rules.length === 0 && !isDraft ? (
                <p className="rounded-xl bg-surface px-3 py-4 text-center text-xs text-ink-muted">
                  Sin flujos aún. Crea uno o usa una plantilla.
                </p>
              ) : null}
              {rules.map((rule) => (
                <FlowListItem
                  key={rule.id}
                  rule={rule}
                  selected={selectedId === rule.id}
                  onOpen={() => openRule(rule)}
                  onToggle={() => void toggleRule(rule)}
                  onDuplicate={() => duplicateRule(rule)}
                  onDelete={() => void deleteRule(rule)}
                />
              ))}
            </>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {!showEditor ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-soft bg-surface/50 p-8 text-center">
              <Workflow className="mb-3 h-10 w-10 text-ink-muted" />
              <p className="text-sm font-medium text-ink">Crea tu primer flujo</p>
              <p className="mt-1 max-w-sm text-xs text-ink-muted">
                Elige un disparador, añade filtros si quieres, y conecta acciones.
              </p>
              <Button className="mt-4" size="sm" onClick={() => openNewFlow()}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nuevo flujo
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-soft bg-white p-3">
                <Field className="min-w-[200px] flex-1">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre del flujo"
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-ink-muted">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  Activo
                </label>
                <Button size="sm" loading={saving} onClick={() => void saveFlow()}>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  Guardar
                </Button>
              </div>

              <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
                <AutomationFlowCanvas
                  flow={flow}
                  flowKey={flowKey}
                  onChange={setFlow}
                  selectedNodeId={selectedNode?.id ?? null}
                  onSelectNode={setSelectedNodeId}
                  onDeleteNode={(nodeId) => {
                    setSelectedNodeId(nodeId);
                    const node = flow.nodes.find((n) => n.id === nodeId);
                    if (node && node.type !== 'trigger') {
                      setFlow((prev) => ({
                        nodes: prev.nodes.filter((n) => n.id !== nodeId),
                        edges: prev.edges.filter(
                          (e) => e.source !== nodeId && e.target !== nodeId,
                        ),
                      }));
                      setSelectedNodeId(triggerNode?.id ?? null);
                    }
                  }}
                />

                <aside className="flex max-h-[calc(100vh-14rem)] flex-col gap-4 overflow-y-auto rounded-2xl border border-border-soft bg-white p-4">
                  {selectedNode ? (
                    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Configurar nodo
                          </p>
                          <p className="mt-0.5 text-sm font-medium capitalize text-ink">
                            {selectedNode.type === 'trigger'
                              ? 'Disparador'
                              : selectedNode.type === 'filter'
                                ? 'Filtro'
                                : 'Acción'}
                          </p>
                        </div>
                        {selectedNode.type !== 'trigger' ? (
                          <button
                            type="button"
                            onClick={deleteSelectedNode}
                            className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                      <FlowNodeInspector
                        node={selectedNode}
                        onChange={(data) => updateNodeData(selectedNode.id, data)}
                      />
                    </div>
                  ) : (
                    <p className="rounded-xl bg-surface px-3 py-2 text-center text-xs text-ink-muted">
                      Haz clic en un nodo del diagrama para configurarlo
                    </p>
                  )}

                  <div className="border-t border-border-soft pt-4">
                    <FlowPalette
                      onPickTrigger={setTriggerType}
                      onAddFilter={() => addNode('filter')}
                      onAddAction={(actionId) => addNode('action', actionId)}
                      onApplyTemplate={(tplFlow, tplName) =>
                        openNewFlow({ flow: tplFlow, name: tplName })
                      }
                    />
                  </div>
                </aside>
              </div>

              {selectedRule?.last_run_at ? (
                <p className="text-right text-[11px] text-ink-muted">
                  Última ejecución: {new Date(selectedRule.last_run_at).toLocaleString()}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </SectionLayout>
  );
}
