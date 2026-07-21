import { useCallback, useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';
import { api } from '../api/client';
import { AgentWorkspace } from '../components/monitor/AgentWorkspace';
import { useRuntimeEvents } from '../hooks/useRuntimeEvents';
import { usePolling } from '../hooks/usePolling';
import { SectionLayout } from '../layout/SectionLayout';

interface AgentState {
  id: string;
  name: string;
  status: string;
  currentTask?: string | null;
  runCount?: number;
  is_enabled?: boolean;
}

interface DashboardSnapshot {
  project?: { name: string };
  agents?: AgentState[];
}

export function MonitorPage() {
  const { connected, logs, agentPulse } = useRuntimeEvents(true);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);

  const refresh = useCallback(async () => {
    const res = await api('/api/dashboard');
    if (res.ok) setSnapshot((await res.json()) as DashboardSnapshot);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, agentPulse]);

  usePolling(() => void refresh(), 15_000, true, false);

  const agents = snapshot?.agents ?? [];

  return (
    <SectionLayout
      title="Monitor"
      description={
        snapshot?.project?.name
          ? `${snapshot.project.name} · espacio de trabajo de agentes`
          : 'Espacio de trabajo de agentes'
      }
      icon={Monitor}
      showFilter={false}
    >
      <AgentWorkspace agents={agents} logs={logs} connected={connected} />
    </SectionLayout>
  );
}
