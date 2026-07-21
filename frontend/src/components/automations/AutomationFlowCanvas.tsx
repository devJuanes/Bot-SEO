import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { flowNodeTypes } from './FlowNodes';
import type { AutomationFlow, FlowNode, FlowNodeData } from '../../lib/automation-flow';

type FlowRfNode = Node<FlowNodeData>;

function toRfNodes(flow: AutomationFlow): FlowRfNode[] {
  return flow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    deletable: n.type !== 'trigger',
  }));
}

function toRfEdges(flow: AutomationFlow): Edge[] {
  return flow.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }));
}

function fromRf(nodes: FlowRfNode[], edges: Edge[]): AutomationFlow {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as FlowNode['type'],
      position: n.position,
      data: n.data,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

export function AutomationFlowCanvas({
  flow,
  flowKey,
  onChange,
  onSelectNode,
  selectedNodeId,
  onDeleteNode,
}: {
  flow: AutomationFlow;
  flowKey: string;
  onChange: (flow: AutomationFlow) => void;
  onSelectNode: (id: string | null) => void;
  selectedNodeId: string | null;
  onDeleteNode?: (nodeId: string) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowRfNode>(toRfNodes(flow));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRfEdges(flow));

  useEffect(() => {
    setNodes(toRfNodes(flow));
    setEdges(toRfEdges(flow));
  }, [flowKey, flow, setNodes, setEdges]);

  const emit = useCallback(
    (nextNodes: FlowRfNode[], nextEdges: Edge[]) => {
      onChange(fromRf(nextNodes, nextEdges));
    },
    [onChange],
  );

  const onNodesDelete = useCallback(
    (deleted: FlowRfNode[]) => {
      const deletedIds = new Set(deleted.map((n) => n.id));
      setEdges((eds) => {
        const nextEdges = eds.filter(
          (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target),
        );
        setNodes((nds) => {
          emit(nds, nextEdges);
          return nds;
        });
        return nextEdges;
      });
      if (deleted.some((n) => n.id === selectedNodeId)) {
        onSelectNode(null);
      }
    },
    [emit, onSelectNode, selectedNodeId, setEdges, setNodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          { ...connection, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
          eds,
        );
        emit(nodes, next);
        return next;
      });
    },
    [emit, nodes, setEdges],
  );

  const onNodeDragStop = useCallback(() => {
    emit(nodes, edges);
  }, [emit, nodes, edges]);

  const nodeTypes = useMemo(() => flowNodeTypes, []);

  return (
    <div className="h-full min-h-[420px] w-full rounded-2xl border border-border-soft bg-slate-50">
      <ReactFlow
        nodes={nodes.map((n) => ({
          ...n,
          selected: n.id === selectedNodeId,
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodesDelete={onNodesDelete}
        onEdgesChange={(changes) => {
          onEdgesChange(changes);
          setTimeout(() => {
            setEdges((eds) => {
              emit(nodes, eds);
              return eds;
            });
          }, 0);
        }}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onNodeContextMenu={(e, node) => {
          e.preventDefault();
          onSelectNode(node.id);
          if (node.type !== 'trigger' && onDeleteNode) {
            if (confirm('¿Eliminar este nodo del flujo?')) {
              onDeleteNode(node.id);
            }
          }
        }}
        onPaneClick={() => onSelectNode(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          className="!rounded-xl !border !border-border-soft !bg-white/90"
        />
      </ReactFlow>
    </div>
  );
}
