import { useCallback, useEffect, useRef, useState } from 'react';
import { getProjectId } from '../api/client';

export interface RuntimeLog {
  level: string;
  agentId?: string;
  message: string;
  ts?: string;
}

export interface RuntimeAgentEvent {
  id: string;
  status: string;
  currentTask?: string | null;
}

export interface RuntimeBusMessage {
  from: string;
  to: string;
  topic: string;
  body: string;
  ts?: string;
}

const MAX_LOGS = 80;
const MAX_BUS = 40;

export function useRuntimeEvents(enabled = true) {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<RuntimeLog[]>([]);
  const [bus, setBus] = useState<RuntimeBusMessage[]>([]);
  const [agentPulse, setAgentPulse] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);

  const appendLog = useCallback((entry: RuntimeLog) => {
    setLogs((prev) => [entry, ...prev].slice(0, MAX_LOGS));
  }, []);

  const appendBus = useCallback((entry: RuntimeBusMessage) => {
    setBus((prev) => [entry, ...prev].slice(0, MAX_BUS));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const pid = getProjectId();
    const qs = pid ? `?projectId=${encodeURIComponent(pid)}` : '';
    const source = new EventSource(`/api/events${qs}`);
    sourceRef.current = source;

    source.addEventListener('open', () => setConnected(true));
    source.addEventListener('error', () => setConnected(false));

    source.addEventListener('log', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as RuntimeLog;
        appendLog(data);
      } catch {
        /* ignore */
      }
    });

    source.addEventListener('agent', () => {
      setAgentPulse((n) => n + 1);
    });

    source.addEventListener('message', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as RuntimeBusMessage;
        appendBus(data);
      } catch {
        /* ignore */
      }
    });

    return () => {
      source.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, [enabled, appendLog, appendBus]);

  return { connected, logs, bus, agentPulse };
}
