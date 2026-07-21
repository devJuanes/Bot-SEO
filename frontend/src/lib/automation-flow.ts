export interface FlowNodeData {
  label: string;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  condition?: { field: string; op: string; value?: string | boolean };
  actionType?: string;
  actionConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FlowNode {
  id: string;
  type: 'trigger' | 'filter' | 'action';
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface AutomationFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface AutomationRule {
  id: string;
  name: string;
  is_enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Array<{ field: string; op: string; value?: string | boolean }>;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  run_count: number;
  last_run_at: string | null;
}

export const TRIGGER_OPTIONS = [
  { id: 'lead.created', label: 'Nuevo lead', desc: 'Cuando se detecta un prospecto nuevo' },
  {
    id: 'lead.status_changed',
    label: 'Cambio de estado',
    desc: 'Al mover un lead en el Kanban',
  },
  {
    id: 'agent.run.started',
    label: 'Agente inició',
    desc: 'Cuando un agente empieza a ejecutarse',
  },
  {
    id: 'agent.run.completed',
    label: 'Agente terminó',
    desc: 'Cuando un agente completa su ejecución',
  },
  {
    id: 'whatsapp.message_received',
    label: 'Mensaje WhatsApp',
    desc: 'Cuando un cliente escribe por WhatsApp',
  },
] as const;

export const ACTION_OPTIONS = [
  {
    id: 'create_notification',
    label: 'Enviar notificación',
    defaults: { title: 'Automatización', body: '', link: '/leads' },
  },
  {
    id: 'update_lead_status',
    label: 'Cambiar estado del lead',
    defaults: { status: 'contacted' },
  },
  {
    id: 'run_agent',
    label: 'Ejecutar agente',
    defaults: { agentId: 'lead-hunter' },
  },
] as const;

export const LEAD_FIELDS = [
  { id: 'status', label: 'Estado' },
  { id: 'needs_website', label: 'Sin web' },
  { id: 'city', label: 'Ciudad' },
  { id: 'source', label: 'Fuente' },
  { id: 'business_type', label: 'Sector' },
] as const;

export const CONDITION_OPS = [
  { id: 'eq', label: 'es igual a' },
  { id: 'neq', label: 'no es igual a' },
  { id: 'contains', label: 'contiene' },
  { id: 'truthy', label: 'es verdadero' },
] as const;

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'won',
  'lost',
  'discarded',
] as const;

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Calificado',
  won: 'Ganado',
  lost: 'Perdido',
  discarded: 'Descartado',
};

export const WHATSAPP_MESSAGE_TYPES = [
  { id: 'any', label: 'Cualquier tipo' },
  { id: 'text', label: 'Texto' },
  { id: 'audio', label: 'Audio' },
  { id: 'image', label: 'Imagen' },
] as const;

export const FLOW_TEMPLATES: Array<{
  id: string;
  name: string;
  desc: string;
  flow: AutomationFlow;
}> = [
  {
    id: 'new-lead-notify',
    name: 'Nuevo lead → notificación',
    desc: 'Avisa cuando entra un prospecto',
    flow: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 40, y: 140 },
          data: { label: 'Nuevo lead', triggerType: 'lead.created', triggerConfig: {} },
        },
        {
          id: 'action-1',
          type: 'action',
          position: { x: 380, y: 140 },
          data: {
            label: 'Enviar notificación',
            actionType: 'create_notification',
            actionConfig: {
              title: 'Nuevo lead detectado',
              body: 'Un agente encontró un prospecto nuevo.',
              link: '/leads',
            },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
    },
  },
  {
    id: 'qualified-notify',
    name: 'Calificado → notificación',
    desc: 'Al pasar a Calificado en el Kanban',
    flow: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 40, y: 140 },
          data: {
            label: 'Cambio de estado',
            triggerType: 'lead.status_changed',
            triggerConfig: { to_status: 'qualified' },
          },
        },
        {
          id: 'action-1',
          type: 'action',
          position: { x: 380, y: 140 },
          data: {
            label: 'Enviar notificación',
            actionType: 'create_notification',
            actionConfig: {
              title: 'Lead calificado',
              body: 'Un lead pasó a Calificado. Revisa el pipeline.',
              link: '/leads',
            },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
    },
  },
  {
    id: 'hunter-done',
    name: 'Lead Hunter terminó',
    desc: 'Cuando el cazador completa búsqueda',
    flow: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 40, y: 140 },
          data: {
            label: 'Agente terminó',
            triggerType: 'agent.run.completed',
            triggerConfig: { agent_id: 'lead-hunter', status: 'success' },
          },
        },
        {
          id: 'action-1',
          type: 'action',
          position: { x: 380, y: 140 },
          data: {
            label: 'Enviar notificación',
            actionType: 'create_notification',
            actionConfig: {
              title: 'Lead Hunter completó',
              body: 'Revisa los nuevos prospectos.',
              link: '/leads',
            },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
    },
  },
  {
    id: 'wa-keyword',
    name: 'WhatsApp con palabra clave',
    desc: 'Si el mensaje contiene una palabra',
    flow: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 40, y: 140 },
          data: {
            label: 'Mensaje WhatsApp',
            triggerType: 'whatsapp.message_received',
            triggerConfig: { keyword: 'precio', message_type: 'text' },
          },
        },
        {
          id: 'action-1',
          type: 'action',
          position: { x: 380, y: 140 },
          data: {
            label: 'Enviar notificación',
            actionType: 'create_notification',
            actionConfig: {
              title: 'Consulta por WhatsApp',
              body: 'Un cliente preguntó por precio.',
              link: '/whatsapp/inbox',
            },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
    },
  },
];

export const AGENT_IDS = [
  'lead-hunter',
  'opportunity-scout',
  'content-radar',
  'blog-writer',
  'social-creator',
  'facebook-publisher',
] as const;

export function defaultFlow(): AutomationFlow {
  return {
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 40, y: 140 },
        data: {
          label: 'Nuevo lead',
          triggerType: 'lead.created',
          triggerConfig: {},
        },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 380, y: 140 },
        data: {
          label: 'Notificación',
          actionType: 'create_notification',
          actionConfig: {
            title: 'Nuevo lead',
            body: 'Hay un prospecto nuevo en tu pipeline.',
            link: '/leads',
          },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
  };
}

export function ruleToFlow(rule: AutomationRule): AutomationFlow {
  const cfg = rule.trigger_config ?? {};
  const stored = cfg._flow as AutomationFlow | undefined;
  if (stored?.nodes?.length) return stored;

  const nodes: FlowNode[] = [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 40, y: 140 },
      data: {
        label: TRIGGER_OPTIONS.find((t) => t.id === rule.trigger_type)?.label ?? 'Disparador',
        triggerType: rule.trigger_type,
        triggerConfig: { ...cfg, _flow: undefined },
      },
    },
  ];
  const edges: FlowEdge[] = [];
  let x = 300;
  let prev = 'trigger-1';

  for (let i = 0; i < rule.conditions.length; i++) {
    const id = `filter-${i}`;
    nodes.push({
      id,
      type: 'filter',
      position: { x, y: 140 },
      data: { label: 'Filtro', condition: rule.conditions[i] },
    });
    edges.push({ id: `e-${prev}-${id}`, source: prev, target: id });
    prev = id;
    x += 260;
  }

  for (let i = 0; i < rule.actions.length; i++) {
    const a = rule.actions[i]!;
    const id = `action-${i}`;
    const opt = ACTION_OPTIONS.find((o) => o.id === a.type);
    nodes.push({
      id,
      type: 'action',
      position: { x, y: 140 },
      data: {
        label: opt?.label ?? a.type,
        actionType: a.type,
        actionConfig: a.config,
      },
    });
    edges.push({ id: `e-${prev}-${id}`, source: prev, target: id });
    prev = id;
    x += 260;
  }

  return { nodes, edges };
}

export function newNodeId(type: string, nodes: FlowNode[]): string {
  const n = nodes.filter((x) => x.type === type).length + 1;
  return `${type}-${n}-${Date.now().toString(36)}`;
}

export function triggerLabel(id?: string): string {
  return TRIGGER_OPTIONS.find((t) => t.id === id)?.label ?? 'Disparador';
}
