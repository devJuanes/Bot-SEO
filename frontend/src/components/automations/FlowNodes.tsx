import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bell, Filter, Zap } from 'lucide-react';
import { cn } from '../../lib/cn';
import { triggerLabel, type FlowNodeData } from '../../lib/automation-flow';

type FlowNodeProps = NodeProps & { data: FlowNodeData };

function NodeShell({
  tone,
  icon: Icon,
  title,
  subtitle,
  handles,
}: {
  tone: 'trigger' | 'filter' | 'action';
  icon: typeof Zap;
  title: string;
  subtitle?: string;
  handles: 'source' | 'target' | 'both';
}) {
  const tones = {
    trigger: 'border-violet-300 bg-violet-50 text-violet-900',
    filter: 'border-amber-300 bg-amber-50 text-amber-900',
    action: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  };
  return (
    <div
      className={cn(
        'min-w-[168px] rounded-xl border-2 px-3 py-2.5 shadow-sm',
        tones[tone],
      )}
    >
      {(handles === 'target' || handles === 'both') && (
        <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-slate-400" />
      )}
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide opacity-70">
            {tone === 'trigger' ? 'Disparador' : tone === 'filter' ? 'Filtro' : 'Acción'}
          </p>
          <p className="truncate text-sm font-medium">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] opacity-70">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {(handles === 'source' || handles === 'both') && (
        <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-slate-400" />
      )}
    </div>
  );
}

export const TriggerFlowNode = memo(function TriggerFlowNode({ data }: FlowNodeProps) {
  return (
    <NodeShell
      tone="trigger"
      icon={Zap}
      title={data.label}
      subtitle={triggerLabel(data.triggerType) !== data.label ? data.triggerType : undefined}
      handles="source"
    />
  );
});

export const FilterFlowNode = memo(function FilterFlowNode({ data }: FlowNodeProps) {
  const c = data.condition;
  const sub = c
    ? `${c.field} ${c.op}${c.value != null ? ` ${c.value}` : ''}`
    : 'Sin configurar';
  return (
    <NodeShell tone="filter" icon={Filter} title={data.label} subtitle={sub} handles="both" />
  );
});

export const ActionFlowNode = memo(function ActionFlowNode({ data }: FlowNodeProps) {
  const sub =
    data.actionType === 'create_notification'
      ? String(data.actionConfig?.title ?? '')
      : data.actionType === 'update_lead_status'
        ? String(data.actionConfig?.status ?? '')
        : data.actionType === 'run_agent'
          ? String(data.actionConfig?.agentId ?? '')
          : data.actionType;
  return (
    <NodeShell tone="action" icon={Bell} title={data.label} subtitle={sub} handles="both" />
  );
});

export const flowNodeTypes = {
  trigger: TriggerFlowNode,
  filter: FilterFlowNode,
  action: ActionFlowNode,
};
