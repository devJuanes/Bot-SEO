import { EventEmitter } from 'node:events';
import type { AgentId } from '../agents/types.js';

export type RuntimeStatus = 'idle' | 'running' | 'error' | 'success';

export interface AgentRuntimeState {
  id: AgentId;
  name: string;
  status: RuntimeStatus;
  currentTask: string | null;
  lastError: string | null;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastDurationMs: number | null;
  runCount: number;
  successCount: number;
  errorCount: number;
}

export interface RuntimeLogEntry {
  id: string;
  ts: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'bus';
  agentId?: AgentId | string;
  message: string;
  details?: Record<string, unknown>;
}

/** Includes non-cron pseudo-agents (webhook/campaign handlers) that also post to the bus. */
export type BusParticipant = AgentId | 'orchestrator' | 'whatsapp-bot' | 'whatsapp-campaign';

export interface AgentBusMessage {
  id: string;
  ts: string;
  from: BusParticipant;
  to: BusParticipant | 'broadcast';
  topic: string;
  body: string;
  payload?: Record<string, unknown>;
}

const MAX_LOGS = 300;
const MAX_BUS = 100;

const bus = new EventEmitter();
bus.setMaxListeners(50);

const logs: RuntimeLogEntry[] = [];
const messages: AgentBusMessage[] = [];

const agents = new Map<AgentId, AgentRuntimeState>();

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function registerRuntimeAgent(id: AgentId, name: string): void {
  if (agents.has(id)) return;
  agents.set(id, {
    id,
    name,
    status: 'idle',
    currentTask: null,
    lastError: null,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastDurationMs: null,
    runCount: 0,
    successCount: 0,
    errorCount: 0,
  });
}

export function getAgentStates(): AgentRuntimeState[] {
  return [...agents.values()];
}

export function getAgentState(id: AgentId): AgentRuntimeState | undefined {
  return agents.get(id);
}

export function pushLog(
  entry: Omit<RuntimeLogEntry, 'id' | 'ts'> & { ts?: string },
): RuntimeLogEntry {
  const full: RuntimeLogEntry = {
    id: uid(),
    ts: entry.ts ?? new Date().toISOString(),
    level: entry.level,
    agentId: entry.agentId,
    message: entry.message,
    details: entry.details,
  };
  logs.unshift(full);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  bus.emit('log', full);
  return full;
}

export function getLogs(limit = 80): RuntimeLogEntry[] {
  return logs.slice(0, limit);
}

export function markAgentStart(
  id: AgentId,
  task: string,
): void {
  const state = agents.get(id);
  if (!state) return;
  state.status = 'running';
  state.currentTask = task;
  state.lastStartedAt = new Date().toISOString();
  state.lastError = null;
  state.runCount += 1;
  pushLog({
    level: 'info',
    agentId: id,
    message: `START · ${task}`,
  });
  bus.emit('agent', state);
}

export function markAgentFinish(
  id: AgentId,
  ok: boolean,
  summary: string,
  error?: string,
): void {
  const state = agents.get(id);
  if (!state) return;
  const finishedAt = new Date().toISOString();
  state.status = ok ? 'success' : 'error';
  state.currentTask = null;
  state.lastFinishedAt = finishedAt;
  state.lastError = error ?? null;
  if (state.lastStartedAt) {
    state.lastDurationMs =
      new Date(finishedAt).getTime() - new Date(state.lastStartedAt).getTime();
  }
  if (ok) state.successCount += 1;
  else state.errorCount += 1;

  pushLog({
    level: ok ? 'success' : 'error',
    agentId: id,
    message: `${ok ? 'OK' : 'FAIL'} · ${summary}`,
    details: error ? { error } : undefined,
  });
  bus.emit('agent', state);

  // Return to idle shortly so UI shows resting robots
  setTimeout(() => {
    const current = agents.get(id);
    if (current && current.status !== 'running') {
      current.status = 'idle';
      bus.emit('agent', current);
    }
  }, 4000);
}

export function sendAgentMessage(
  message: Omit<AgentBusMessage, 'id' | 'ts'> & { ts?: string },
): AgentBusMessage {
  const full: AgentBusMessage = {
    id: uid(),
    ts: message.ts ?? new Date().toISOString(),
    from: message.from,
    to: message.to,
    topic: message.topic,
    body: message.body,
    payload: message.payload,
  };
  messages.unshift(full);
  if (messages.length > MAX_BUS) messages.length = MAX_BUS;
  pushLog({
    level: 'bus',
    agentId: message.from,
    message: `BUS → ${message.to} · ${message.topic}: ${message.body}`,
    details: message.payload,
  });
  bus.emit('message', full);
  return full;
}

export function getBusMessages(limit = 40): AgentBusMessage[] {
  return messages.slice(0, limit);
}

export function onRuntimeEvent(
  event: 'log' | 'agent' | 'message',
  listener: (payload: unknown) => void,
): () => void {
  bus.on(event, listener);
  return () => bus.off(event, listener);
}
