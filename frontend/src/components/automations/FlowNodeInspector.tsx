import {
  ACTION_OPTIONS,
  AGENT_IDS,
  CONDITION_OPS,
  LEAD_FIELDS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  TRIGGER_OPTIONS,
  WHATSAPP_MESSAGE_TYPES,
  triggerLabel,
  type FlowNode,
  type FlowNodeData,
} from '../../lib/automation-flow';
import { Field, Input, Label, Select, Textarea } from '../ui/Input';

function InspectorFields({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

export function FlowNodeInspector({
  node,
  onChange,
}: {
  node: FlowNode;
  onChange: (data: FlowNodeData) => void;
}) {
  const data = node.data;

  if (node.type === 'trigger') {
    const cfg = data.triggerConfig ?? {};
    return (
      <InspectorFields>
        <Field>
          <Label>Evento</Label>
          <Select
            value={data.triggerType ?? 'lead.created'}
            onChange={(e) => {
              const triggerType = e.target.value;
              onChange({
                ...data,
                triggerType,
                label: triggerLabel(triggerType),
                triggerConfig: { ...cfg },
              });
            }}
          >
            {TRIGGER_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        {data.triggerType === 'lead.status_changed' ? (
          <>
            <Field>
              <Label>Desde estado</Label>
              <Select
                value={String(cfg.from_status ?? '')}
                onChange={(e) =>
                  onChange({
                    ...data,
                    triggerConfig: { ...cfg, from_status: e.target.value || undefined },
                  })
                }
              >
                <option value="">Cualquiera</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STATUS_LABELS[s] ?? s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Hacia estado</Label>
              <Select
                value={String(cfg.to_status ?? '')}
                onChange={(e) =>
                  onChange({
                    ...data,
                    triggerConfig: { ...cfg, to_status: e.target.value || undefined },
                  })
                }
              >
                <option value="">Cualquiera</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STATUS_LABELS[s] ?? s}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}
        {data.triggerType === 'agent.run.completed' ||
        data.triggerType === 'agent.run.started' ? (
          <>
            <Field>
              <Label>Agente</Label>
              <Select
                value={String(cfg.agent_id ?? '')}
                onChange={(e) =>
                  onChange({
                    ...data,
                    triggerConfig: { ...cfg, agent_id: e.target.value || undefined },
                  })
                }
              >
                <option value="">Cualquiera</option>
                {AGENT_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </Select>
            </Field>
            {data.triggerType === 'agent.run.completed' ? (
              <Field>
                <Label>Resultado</Label>
                <Select
                  value={String(cfg.status ?? '')}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      triggerConfig: {
                        ...cfg,
                        status: e.target.value || undefined,
                      },
                    })
                  }
                >
                  <option value="">Cualquiera</option>
                  <option value="success">Éxito</option>
                  <option value="error">Error</option>
                </Select>
              </Field>
            ) : null}
          </>
        ) : null}
        {data.triggerType === 'whatsapp.message_received' ? (
          <>
            <Field>
              <Label>Palabra clave (opcional)</Label>
              <Input
                value={String(cfg.keyword ?? '')}
                placeholder="ej. precio, cotización"
                onChange={(e) =>
                  onChange({
                    ...data,
                    triggerConfig: { ...cfg, keyword: e.target.value || undefined },
                  })
                }
              />
            </Field>
            <Field>
              <Label>Tipo de mensaje</Label>
              <Select
                value={String(cfg.message_type ?? 'any')}
                onChange={(e) =>
                  onChange({
                    ...data,
                    triggerConfig: { ...cfg, message_type: e.target.value },
                  })
                }
              >
                {WHATSAPP_MESSAGE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}
        <p className="rounded-xl bg-surface px-3 py-2 text-xs leading-relaxed text-ink-muted">
          {TRIGGER_OPTIONS.find((t) => t.id === data.triggerType)?.desc}
        </p>
      </InspectorFields>
    );
  }

  if (node.type === 'filter') {
    const c = data.condition ?? { field: 'needs_website', op: 'truthy' };
    return (
      <InspectorFields>
        <Field>
          <Label>Campo del lead</Label>
          <Select
            value={c.field}
            onChange={(e) =>
              onChange({
                ...data,
                label: 'Filtro',
                condition: { ...c, field: e.target.value },
              })
            }
          >
            {LEAD_FIELDS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>Condición</Label>
          <Select
            value={c.op}
            onChange={(e) =>
              onChange({
                ...data,
                condition: { ...c, op: e.target.value },
              })
            }
          >
            {CONDITION_OPS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {c.op !== 'truthy' ? (
          <Field>
            <Label>Valor</Label>
            <Input
              value={String(c.value ?? '')}
              onChange={(e) =>
                onChange({
                  ...data,
                  condition: { ...c, value: e.target.value },
                })
              }
            />
          </Field>
        ) : null}
      </InspectorFields>
    );
  }

  if (node.type === 'action') {
    const actionType = data.actionType ?? 'create_notification';
    const cfg = data.actionConfig ?? {};
    const opt = ACTION_OPTIONS.find((o) => o.id === actionType);
    return (
      <InspectorFields>
        <Field>
          <Label>Tipo de acción</Label>
          <Select
            value={actionType}
            onChange={(e) => {
              const next = ACTION_OPTIONS.find((o) => o.id === e.target.value);
              onChange({
                ...data,
                label: next?.label ?? 'Acción',
                actionType: e.target.value,
                actionConfig: { ...(next?.defaults ?? {}) },
              });
            }}
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {actionType === 'create_notification' ? (
          <>
            <Field>
              <Label>Título</Label>
              <Input
                value={String(cfg.title ?? '')}
                onChange={(e) =>
                  onChange({
                    ...data,
                    actionConfig: { ...cfg, title: e.target.value },
                  })
                }
              />
            </Field>
            <Field>
              <Label>Mensaje</Label>
              <Textarea
                className="min-h-[72px]"
                value={String(cfg.body ?? '')}
                onChange={(e) =>
                  onChange({
                    ...data,
                    actionConfig: { ...cfg, body: e.target.value },
                  })
                }
              />
            </Field>
            <Field>
              <Label>Enlace</Label>
              <Input
                value={String(cfg.link ?? '')}
                onChange={(e) =>
                  onChange({
                    ...data,
                    actionConfig: { ...cfg, link: e.target.value },
                  })
                }
              />
            </Field>
          </>
        ) : null}
        {actionType === 'update_lead_status' ? (
          <Field>
            <Label>Nuevo estado</Label>
            <Select
              value={String(cfg.status ?? 'contacted')}
              onChange={(e) =>
                onChange({
                  ...data,
                  actionConfig: { ...cfg, status: e.target.value },
                })
              }
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {actionType === 'run_agent' ? (
          <Field>
            <Label>Agente</Label>
            <Select
              value={String(cfg.agentId ?? 'lead-hunter')}
              onChange={(e) =>
                onChange({
                  ...data,
                  actionConfig: { ...cfg, agentId: e.target.value },
                })
              }
            >
              {AGENT_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {!opt ? (
          <p className="text-sm text-ink-muted">Selecciona una acción</p>
        ) : null}
      </InspectorFields>
    );
  }

  return null;
}
