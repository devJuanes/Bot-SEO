import type {
  AutomationAction,
  AutomationCondition,
  AutomationRule,
} from '../db/automation.js';

export interface FlowNodeData {
  label: string;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  condition?: AutomationCondition;
  actionType?: AutomationAction['type'];
  actionConfig?: Record<string, unknown>;
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

const FLOW_KEY = '_flow';

export function defaultFlow(): AutomationFlow {
  return {
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 40, y: 120 },
        data: {
          label: 'Disparador',
          triggerType: 'lead.created',
          triggerConfig: {},
        },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 360, y: 120 },
        data: {
          label: 'Notificar',
          actionType: 'create_notification',
          actionConfig: {
            title: 'Evento detectado',
            body: 'Se ejecutó un disparador en tu flujo.',
            link: '/leads',
          },
        },
      },
    ],
    edges: [{ id: 'e-trigger-action', source: 'trigger-1', target: 'action-1' }],
  };
}

function orderNodesFromTrigger(
  flow: AutomationFlow,
): FlowNode[] {
  const trigger = flow.nodes.find((n) => n.type === 'trigger');
  if (!trigger) throw new Error('El flujo necesita un nodo Disparador');

  const ordered: FlowNode[] = [trigger];
  const visited = new Set([trigger.id]);
  let current = trigger.id;

  while (ordered.length < flow.nodes.length) {
    const edge = flow.edges.find((e) => e.source === current);
    if (!edge) break;
    const next = flow.nodes.find((n) => n.id === edge.target);
    if (!next || visited.has(next.id)) break;
    ordered.push(next);
    visited.add(next.id);
    current = next.id;
  }

  const missing = flow.nodes.filter((n) => !visited.has(n.id));
  for (const node of missing) {
    if (node.type !== 'trigger') ordered.push(node);
  }

  return ordered;
}

export function compileFlow(
  flow: AutomationFlow,
  name: string,
): {
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
} {
  const ordered = orderNodesFromTrigger(flow);
  const trigger = ordered.find((n) => n.type === 'trigger');
  if (!trigger?.data.triggerType) {
    throw new Error('Configura el nodo Disparador');
  }

  const conditions: AutomationCondition[] = [];
  const actions: AutomationAction[] = [];

  for (const node of ordered) {
    if (node.type === 'filter' && node.data.condition) {
      conditions.push(node.data.condition);
    }
    if (node.type === 'action' && node.data.actionType) {
      actions.push({
        type: node.data.actionType,
        config: node.data.actionConfig ?? {},
      });
    }
  }

  if (actions.length === 0) {
    throw new Error('Agrega al menos un nodo Acción al flujo');
  }

  const triggerConfig = {
    ...(trigger.data.triggerConfig ?? {}),
    [FLOW_KEY]: flow,
  };

  return {
    name: name.trim(),
    trigger_type: trigger.data.triggerType,
    trigger_config: triggerConfig,
    conditions,
    actions,
  };
}

export function ruleToFlow(rule: AutomationRule): AutomationFlow {
  const cfg = rule.trigger_config ?? {};
  const stored = cfg[FLOW_KEY] as AutomationFlow | undefined;
  if (stored?.nodes?.length) return stored;

  const nodes: FlowNode[] = [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 40, y: 120 },
      data: {
        label: 'Disparador',
        triggerType: rule.trigger_type,
        triggerConfig: { ...cfg, [FLOW_KEY]: undefined },
      },
    },
  ];
  const edges: FlowEdge[] = [];
  let x = 280;
  let prevId = 'trigger-1';

  for (let i = 0; i < (rule.conditions?.length ?? 0); i++) {
    const id = `filter-${i + 1}`;
    nodes.push({
      id,
      type: 'filter',
      position: { x, y: 120 },
      data: {
        label: 'Filtro',
        condition: rule.conditions[i],
      },
    });
    edges.push({ id: `e-${prevId}-${id}`, source: prevId, target: id });
    prevId = id;
    x += 240;
  }

  for (let i = 0; i < (rule.actions?.length ?? 0); i++) {
    const action = rule.actions[i]!;
    const id = `action-${i + 1}`;
    nodes.push({
      id,
      type: 'action',
      position: { x, y: 120 },
      data: {
        label: actionLabel(action.type),
        actionType: action.type,
        actionConfig: action.config,
      },
    });
    edges.push({ id: `e-${prevId}-${id}`, source: prevId, target: id });
    prevId = id;
    x += 240;
  }

  return { nodes, edges };
}

function actionLabel(type: string): string {
  switch (type) {
    case 'create_notification':
      return 'Notificación';
    case 'update_lead_status':
      return 'Cambiar estado';
    case 'run_agent':
      return 'Ejecutar agente';
    default:
      return type;
  }
}

export function flowWithLayout(
  flow: AutomationFlow,
): AutomationFlow {
  return {
    nodes: flow.nodes.map((n) => ({
      ...n,
      position: { ...n.position },
      data: { ...n.data },
    })),
    edges: flow.edges.map((e) => ({ ...e })),
  };
}
