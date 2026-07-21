import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { api, projectApi } from '../../api/client';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { cn } from '../../lib/cn';

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: boolean;
  streaming?: boolean;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split('\n');
  let event = 'message';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  return data ? { event, data } : null;
}

export async function streamAgentChat(
  agentId: string,
  input: { sessionId: string; message: string },
  handlers: {
    onThinking?: () => void;
    onToken?: (text: string) => void;
    onDone?: (reply: string) => void;
    onError?: (message: string) => void;
  },
  options?: { variant?: 'catalog' | 'custom' },
): Promise<void> {
  const variant = options?.variant ?? 'catalog';
  const res =
    variant === 'custom'
      ? await projectApi(`/custom-agents/${encodeURIComponent(agentId)}/chat/stream`, {
          method: 'POST',
          body: JSON.stringify(input),
        })
      : await api(`/api/agents/${encodeURIComponent(agentId)}/chat/stream`, {
          method: 'POST',
          body: JSON.stringify(input),
        });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'No se pudo conectar con el agente');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('El servidor no devolvió stream');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const parsed = parseSseBlock(part.trim());
      if (!parsed) continue;
      try {
        const payload = JSON.parse(parsed.data) as Record<string, unknown>;
        if (parsed.event === 'thinking') handlers.onThinking?.();
        else if (parsed.event === 'token') handlers.onToken?.(String(payload.text ?? ''));
        else if (parsed.event === 'done') handlers.onDone?.(String(payload.reply ?? ''));
        else if (parsed.event === 'error') {
          handlers.onError?.(String(payload.message ?? 'Error'));
        }
      } catch {
        // ignore malformed SSE chunk
      }
    }
  }
}

export function AgentChatPanel({
  agentId,
  sessionId,
  variant = 'catalog',
  className,
}: {
  agentId: string;
  sessionId: string;
  variant?: 'catalog' | 'custom';
  className?: string;
}) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res =
        variant === 'custom'
          ? await projectApi(
              `/custom-agents/${encodeURIComponent(agentId)}/chat?sessionId=${encodeURIComponent(sessionId)}`,
            )
          : await api(
              `/api/agents/${encodeURIComponent(agentId)}/chat?sessionId=${encodeURIComponent(sessionId)}`,
            );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar chat');
      setMessages(
        (data.messages || []).map((m: { role: string; content: string }, i: number) => ({
          id: `hist-${i}`,
          role: m.role as AgentChatMessage['role'],
          content: m.content,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [agentId, sessionId, variant]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;
    setInput('');
    setSending(true);
    setError('');
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', thinking: true, streaming: true },
    ]);

    try {
      await streamAgentChat(
        agentId,
        { sessionId, message: text },
        {
          onThinking: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, thinking: true, streaming: true } : m,
              ),
            );
          },
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      thinking: false,
                      streaming: true,
                      content: m.content + token,
                    }
                  : m,
              ),
            );
          },
          onDone: (reply) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, thinking: false, streaming: false, content: reply }
                  : m,
              ),
            );
          },
          onError: (message) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      thinking: false,
                      streaming: false,
                      content: message,
                      role: 'system',
                    }
                  : m,
              ),
            );
          },
        },
        { variant },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, thinking: false, streaming: false, content: message, role: 'system' }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={cn('soft-card flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="border-b border-border-soft px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Chat con el agente</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Respuestas en tiempo real · el historial se guarda
        </p>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-ink-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando conversación…
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Pregunta qué está haciendo, en qué ciudad busca o si encontró algo.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'ml-auto bg-brand-600 text-white'
                  : msg.role === 'system'
                    ? 'bg-amber-50 text-amber-900'
                    : 'bg-surface text-ink ring-1 ring-border-soft',
              )}
            >
              {msg.role === 'assistant' && msg.thinking && !msg.content ? (
                <span className="inline-flex items-center gap-2 text-ink-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                  Pensando…
                </span>
              ) : (
                <p className="whitespace-pre-wrap">
                  {msg.content}
                  {msg.streaming && msg.content ? (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand-600 align-middle" />
                  ) : null}
                </p>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="border-t border-border-soft bg-brand-50 px-4 py-2 text-xs text-brand-700">
          {error}
        </p>
      )}

      <div className="shrink-0 border-t border-border-soft bg-white p-3">
        <div className="flex gap-2">
          <Textarea
            className="min-h-[44px] max-h-28 flex-1 resize-none"
            rows={2}
            value={input}
            disabled={sending}
            placeholder="Escribe tu mensaje…"
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            className="self-end"
            disabled={sending || !input.trim()}
            onClick={() => void send()}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
