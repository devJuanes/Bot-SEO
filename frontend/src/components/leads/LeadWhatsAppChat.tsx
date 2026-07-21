import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Send, Bot, UserRound } from 'lucide-react';
import { api, apiJson } from '../../api/client';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Textarea } from '../ui/Input';
import { LoadingState } from '../ui/DataTable';
import { cn } from '../../lib/cn';

interface LeadSummary {
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

interface WaMessage {
  id: string;
  direction: string;
  body: string;
  created_at: string;
}

interface WaConversation {
  id: string;
  wa_id: string;
  mode: string;
  unread_count: number;
}

interface Proposal {
  id: string;
  label: string;
  tone: 'brand' | 'warning' | 'info' | 'success';
  text: string;
}

type Tab = 'chat' | 'ai';

const MODE_LABELS: Record<string, { label: string; tone: 'brand' | 'warning' }> = {
  bot: { label: 'Bot', tone: 'brand' },
  human: { label: 'Humano', tone: 'warning' },
};

export function LeadWhatsAppChat({
  lead,
  onStatusChange,
}: {
  lead: LeadSummary;
  onStatusChange?: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [waId, setWaId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<WaConversation | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiJson<{
        configured: boolean;
        hasPhone: boolean;
        waId: string | null;
        conversation: WaConversation | null;
        messages: WaMessage[];
        error?: string;
      }>(`/api/leads/${encodeURIComponent(lead.id)}/whatsapp`);

      setConfigured(data.configured);
      setHasPhone(data.hasPhone);
      setWaId(data.waId);
      setConversation(data.conversation);
      setMessages(data.messages || []);
      setUnread(data.conversation?.unread_count ?? 0);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar WhatsApp');
    } finally {
      setLoading(false);
    }
  }, [lead.id]);

  useEffect(() => {
    if (open) void loadChat();
  }, [open, loadChat]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  async function loadProposals() {
    setLoadingProposals(true);
    setError('');
    try {
      const data = await apiJson<{ proposals: Proposal[] }>(
        `/api/leads/${encodeURIComponent(lead.id)}/whatsapp/proposals`,
        { method: 'POST', body: '{}' },
      );
      setProposals(data.proposals || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron generar propuestas');
    } finally {
      setLoadingProposals(false);
    }
  }

  useEffect(() => {
    if (open && tab === 'ai' && proposals.length === 0 && !loadingProposals) {
      void loadProposals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  async function sendReply(textOverride?: string) {
    const text = (textOverride ?? reply).trim();
    if (!text) return;
    setSending(true);
    setError('');
    try {
      const data = await apiJson<{ messages: WaMessage[] }>(
        `/api/leads/${encodeURIComponent(lead.id)}/whatsapp/reply`,
        {
          method: 'POST',
          body: JSON.stringify({ text }),
        },
      );
      setMessages(data.messages || []);
      if (!textOverride) setReply('');
      setTab('chat');
      if (lead.status === 'new') onStatusChange?.('contacted');
      await loadChat();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  async function toggleMode(mode: 'bot' | 'human') {
    if (!conversation) return;
    await api(`/api/whatsapp/conversations/${encodeURIComponent(conversation.id)}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    await loadChat();
  }

  const modeMeta = conversation ? MODE_LABELS[conversation.mode] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition hover:scale-105 hover:bg-[#20bd5a] focus:outline-none focus:ring-4 focus:ring-[#25D366]/25"
        title={`WhatsApp con ${lead.name}`}
      >
        <MessageCircle className="h-6 w-6" />
        {!open && unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        title={lead.name}
        subtitle={waId || lead.phone || 'WhatsApp'}
        headerExtra={
          <>
            <Badge tone={configured ? 'success' : 'danger'}>
              {configured ? 'WA' : 'Sin WA'}
            </Badge>
            {modeMeta ? <Badge tone={modeMeta.tone}>{modeMeta.label}</Badge> : null}
            {conversation ? (
              <Link
                to={`/whatsapp/mensajes/${conversation.id}`}
                className="text-[10px] font-medium text-brand-600 hover:underline"
                onClick={() => setOpen(false)}
              >
                Inbox
              </Link>
            ) : null}
          </>
        }
      >
        {!configured ? (
          <div className="p-4">
            <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
              Configura WhatsApp en{' '}
              <Link to="/settings/whatsapp" className="font-medium underline">
                Ajustes
              </Link>
              .
            </p>
          </div>
        ) : !hasPhone ? (
          <div className="p-4">
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Este lead no tiene teléfono para WhatsApp.
            </p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 gap-1 border-b border-border-soft px-3 py-2">
              <button
                type="button"
                onClick={() => setTab('chat')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition',
                  tab === 'chat'
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-ink-muted hover:bg-surface',
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Chat
              </button>
              <button
                type="button"
                onClick={() => setTab('ai')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition',
                  tab === 'ai'
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-ink-muted hover:bg-surface',
                )}
              >
                <Bot className="h-3.5 w-3.5" />
                Propuestas IA
              </button>
            </div>

            {conversation ? (
              <div className="flex shrink-0 gap-1.5 border-b border-border-soft px-3 py-2">
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => void toggleMode('bot')}>
                  Bot
                </Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => void toggleMode('human')}>
                  <UserRound className="h-3 w-3" />
                  Humano
                </Button>
              </div>
            ) : null}

            {error ? (
              <p className="mx-3 mt-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">{error}</p>
            ) : null}

            {tab === 'chat' ? (
              <>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
                  {loading ? (
                    <LoadingState label="Cargando…" />
                  ) : messages.length === 0 ? (
                    <p className="py-8 text-center text-xs text-ink-muted">
                      Sin mensajes. Prueba las propuestas IA o escribe abajo.
                    </p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          'max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm',
                          m.direction === 'outbound'
                            ? 'ml-auto bg-brand-600 text-white'
                            : 'bg-white text-ink ring-1 ring-border-soft',
                        )}
                      >
                        {m.body}
                        <div className="mt-0.5 text-[9px] opacity-60">
                          {new Date(m.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="flex shrink-0 gap-2 border-t border-border-soft p-3">
                  <Textarea
                    className="min-h-[40px] flex-1 resize-none text-xs"
                    rows={2}
                    placeholder="Mensaje…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => void sendReply()}
                    disabled={sending || !reply.trim()}
                    loading={sending}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-ink-muted">
                    Mensajes sugeridos según el perfil del lead.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 shrink-0 text-xs"
                    loading={loadingProposals}
                    onClick={() => void loadProposals()}
                  >
                    {proposals.length ? 'Regenerar' : 'Generar'}
                  </Button>
                </div>

                {loadingProposals && proposals.length === 0 ? (
                  <LoadingState label="Generando propuestas…" />
                ) : (
                  <div className="space-y-2">
                    {proposals.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-border-soft bg-surface p-3"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <Badge tone={p.tone}>{p.label}</Badge>
                          <button
                            type="button"
                            className="text-[10px] font-medium text-ink-muted hover:text-ink"
                            onClick={() => {
                              setReply(p.text);
                              setTab('chat');
                            }}
                          >
                            Editar
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed text-ink-muted">{p.text}</p>
                        <Button
                          size="sm"
                          className="mt-2 h-7 w-full text-xs"
                          loading={sending}
                          onClick={() => void sendReply(p.text)}
                        >
                          <Send className="h-3 w-3" />
                          Enviar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
