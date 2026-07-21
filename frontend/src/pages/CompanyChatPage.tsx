import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquare, Mic, Send, User } from 'lucide-react';
import { projectApi } from '../api/client';
import { ChatMarkdown } from '../components/chat/ChatMarkdown';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Input';
import { GateModal } from '../components/ui/Modal';
import { LoadingState } from '../components/ui/DataTable';
import { SectionLayout } from '../layout/SectionLayout';
import { useSetup } from '../hooks/useSetup';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { cn } from '../lib/cn';

interface ChatMsg {
  id?: string;
  role: string;
  content: string;
  created_at?: string;
}

const SUGGESTED_PROMPTS = [
  '¿Qué servicios ofrecemos?',
  'Ideas de growth para esta semana',
  'Resume mi marca en 3 puntos',
];

function ChatBubble({
  role,
  content,
  pending,
}: {
  role: string;
  content: string;
  pending?: boolean;
}) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          'w-fit max-w-[min(100%,34rem)] rounded-2xl px-4 py-3 shadow-sm',
          isUser
            ? 'bg-brand-600 text-white'
            : 'border border-border-soft bg-white text-ink',
        )}
      >
        {pending ? (
          <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            Pensando…
          </span>
        ) : isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        ) : (
          <ChatMarkdown content={content} linkClassName="text-brand-600" />
        )}
      </div>
    </div>
  );
}

export function CompanyChatPage() {
  const { status } = useSetup();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [gateLlm, setGateLlm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      if (status && !status.llmConfigured) {
        setGateLlm(true);
        return;
      }

      setInput('');
      setSending(true);
      setError('');
      setMessages((m) => [...m, { role: 'user', content: trimmed }]);

      try {
        const res = await projectApi('/company-chat', {
          method: 'POST',
          body: JSON.stringify({ message: trimmed, sessionId: 'default' }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409) setGateLlm(true);
          throw new Error(data.error || 'Error');
        }
        setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSending(false);
        focusInput();
      }
    },
    [focusInput, sending, status],
  );

  const { listening, transcribing, preparing, supported, toggle } = useSpeechToText({
    onFinal: (text) => {
      void sendMessage(text);
    },
    onError: (message) => setError(message),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectApi('/company-chat?sessionId=default');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessages(data.messages || []);
      if (data.llmConfigured === false) setGateLlm(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading) focusInput();
  }, [focusInput, loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  return (
    <SectionLayout
      title="Chat de empresa"
      description="Asistente IA con el modelo y tokens de tu proyecto."
      icon={MessageSquare}
    >
      <div className="soft-card flex h-[calc(100dvh-11.5rem)] min-h-[520px] flex-col overflow-hidden">
        <div className="border-b border-border-soft bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Asistente MatuByte</h2>
              <p className="text-xs text-ink-muted">
                Pregunta sobre tu marca, estrategia o próximos pasos
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-surface/60 px-4 py-5 sm:px-6">
          {loading ? (
            <LoadingState label="Cargando conversación…" />
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-white">
                <MessageSquare className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">¿En qué te ayudo hoy?</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Pregunta sobre tu marca, clientes ideales, contenido o qué hacer esta semana para
                crecer.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    disabled={sending || listening}
                    className="rounded-full border border-border-soft bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-brand-200 hover:bg-brand-50/50 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <ChatBubble key={m.id ?? i} role={m.role} content={m.content} />
              ))}
              {sending ? <ChatBubble role="assistant" content="" pending /> : null}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <p className="border-t border-border-soft bg-brand-50 px-5 py-2.5 text-xs text-brand-700">
            {error}
          </p>
        ) : null}

        <div className="border-t border-border-soft bg-white p-4 sm:p-5">
          {listening ? (
            <p className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-brand-600">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-600" />
              </span>
              Grabando… pulsa el micrófono otra vez para enviar
            </p>
          ) : preparing || transcribing ? (
            <p className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-brand-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcribiendo tu voz…
            </p>
          ) : null}

          <div className="flex items-end gap-2 sm:gap-3">
            {supported ? (
              <Button
                type="button"
                variant={listening ? 'primary' : 'secondary'}
                className={cn(
                  'h-11 w-11 shrink-0 rounded-2xl p-0',
                  listening && 'bg-brand-600 shadow-md shadow-brand-600/25',
                )}
                disabled={sending || transcribing || preparing}
                onClick={toggle}
                title={
                  listening
                    ? 'Detener y enviar'
                    : transcribing
                      ? 'Transcribiendo…'
                      : 'Dictar mensaje'
                }
              >
                {transcribing || preparing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className={cn('h-4 w-4', listening && 'animate-pulse')} />
                )}
              </Button>
            ) : null}

            <Textarea
              ref={inputRef}
              className="!min-h-0 h-11 max-h-24 flex-1 resize-none rounded-2xl border-border-soft bg-surface px-4 py-2.5 text-sm leading-normal"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                listening
                  ? 'Grabando tu voz…'
                  : transcribing
                    ? 'Transcribiendo…'
                    : 'Escribe un mensaje…'
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
            />

            <Button
              className="h-11 w-11 shrink-0 rounded-2xl p-0"
              loading={sending}
              disabled={sending || listening || !input.trim()}
              onClick={() => void sendMessage(input)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* <p className="mt-2 text-center text-[11px] text-ink-muted">
            Enter para enviar · Micrófono: graba, vuelve a pulsar y envía el texto
          </p> */}
        </div>
      </div>

      <GateModal
        open={gateLlm}
        onClose={() => setGateLlm(false)}
        title="LLM no configurado"
        message="Configura proveedor, modelo y API key en Ajustes → LLM / IA."
        ctaLabel="Ir a LLM"
        ctaTo="/settings/llm"
      />
    </SectionLayout>
  );
}
