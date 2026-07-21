import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, Send } from 'lucide-react';
import { api, apiJson } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { EmptyState, LoadingState } from '../../components/ui/DataTable';
import { SectionLayout } from '../../layout/SectionLayout';
import { usePolling } from '../../hooks/usePolling';
import { useWhatsAppUnread } from '../../hooks/useWhatsAppUnread';
import { cn } from '../../lib/cn';

interface Conversation {
  id: string;
  profile_name?: string;
  wa_id: string;
  mode: string;
  unread_count: number;
  last_message_at?: string;
}

interface Message {
  id: string;
  direction: string;
  body: string;
  message_type?: string;
  created_at: string;
}

const WA_TABS = [
  { to: '/whatsapp/mensajes', label: 'Mensajes' },
  { to: '/whatsapp/campaigns', label: 'Campañas' },
  { to: '/whatsapp/contacts', label: 'Contactos' },
  { to: '/whatsapp/templates', label: 'Plantillas' },
];

function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function WhatsAppInboxPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { refresh: refreshUnreadBadge } = useWhatsAppUnread(true);
  const [configured, setConfigured] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const refresh = useCallback(async (silent = false) => {
    try {
      setError('');
      const status = await apiJson<{ configured: boolean }>('/api/whatsapp/status');
      setConfigured(status.configured);
      if (!status.configured) {
        setConversations([]);
        return;
      }
      const conv = await apiJson<{ conversations: Conversation[] }>(
        '/api/whatsapp/conversations',
      );
      setConversations(conv.conversations || []);
      void refreshUnreadBadge();
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar las conversaciones');
        setConversations([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [refreshUnreadBadge]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(() => void refresh(true), 3_000, configured, false);

  const loadMessages = useCallback(
    async (id: string, options?: { markRead?: boolean; silent?: boolean }) => {
      const markRead = options?.markRead ?? false;
      const qs = markRead ? '' : '?markRead=0';
      try {
        const data = await apiJson<{ messages: Message[] }>(
          `/api/whatsapp/conversations/${encodeURIComponent(id)}/messages${qs}`,
        );
        const next = data.messages || [];
        setMessages(next);
        if (markRead) {
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)),
          );
          void refreshUnreadBadge();
        }
        if (next.length > prevMessageCountRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        prevMessageCountRef.current = next.length;
      } catch {
        if (!options?.silent) setMessages([]);
      }
    },
    [refreshUnreadBadge],
  );

  useEffect(() => {
    if (conversationId) {
      prevMessageCountRef.current = 0;
      void loadMessages(conversationId, { markRead: true });
    } else {
      setMessages([]);
      prevMessageCountRef.current = 0;
    }
  }, [conversationId, loadMessages]);

  usePolling(
    () => {
      if (conversationId) void loadMessages(conversationId, { markRead: false, silent: true });
    },
    3_000,
    Boolean(conversationId && configured),
    false,
  );

  async function sendReply() {
    if (!conversationId || !reply.trim()) return;
    setSending(true);
    try {
      await api(`/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text: reply.trim() }),
      });
      setReply('');
      await loadMessages(conversationId, { markRead: true });
      await refresh(true);
    } finally {
      setSending(false);
    }
  }

  async function toggleMode(mode: 'bot' | 'human') {
    if (!conversationId) return;
    await api(`/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    await refresh();
  }

  const active = conversations.find((c) => c.id === conversationId);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <SectionLayout
      title="WhatsApp"
      description="Mensajes en tiempo real, conversaciones y modo humano/bot."
      icon={MessageCircle}
      tabs={WA_TABS}
      showFilter={false}
      actions={
        <div className="flex items-center gap-2">
          {totalUnread > 0 ? <UnreadBadge count={totalUnread} /> : null}
          <Badge tone={configured ? 'success' : 'danger'}>
            {configured ? 'Meta conectado' : 'Sin configurar'}
          </Badge>
        </div>
      }
    >
      {loading ? (
        <LoadingState label="Cargando mensajes…" />
      ) : error ? (
        <EmptyState
          icon={MessageCircle}
          title="No se pudieron cargar los mensajes"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void refresh()}>
              Reintentar
            </Button>
          }
        />
      ) : !configured ? (
        <EmptyState
          icon={MessageCircle}
          title="WhatsApp no configurado"
          description="Añade Access Token y Phone Number ID en Ajustes → WhatsApp."
          action={
            <Button onClick={() => navigate('/settings/whatsapp')}>Ir a ajustes</Button>
          }
        />
      ) : (
        <div className="grid h-[calc(100vh-220px)] min-h-[520px] gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-900">Conversaciones</span>
              {totalUnread > 0 ? <UnreadBadge count={totalUnread} /> : null}
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No hay conversaciones. Escribe al número de WhatsApp Business para probar.
                </div>
              ) : (
                conversations.map((c) => {
                  const unread = conversationId === c.id ? 0 : c.unread_count || 0;
                  return (
                    <Link
                      key={c.id}
                      to={`/whatsapp/mensajes/${c.id}`}
                      className={cn(
                        'block cursor-pointer border-b border-slate-50 px-4 py-3 transition hover:bg-brand-50/50',
                        conversationId === c.id && 'bg-brand-50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-900">
                          {c.profile_name || c.wa_id}
                        </span>
                        <UnreadBadge count={unread} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate">{c.wa_id}</span>
                        <span className="shrink-0">{timeAgo(c.last_message_at)}</span>
                      </div>
                      <div className="mt-1">
                        <Badge tone={c.mode === 'human' ? 'warning' : 'brand'}>
                          {c.mode === 'human' ? 'HUMANO' : 'BOT'}
                        </Badge>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="flex flex-col overflow-hidden">
            {!conversationId ? (
              <CardBody className="flex flex-1 items-center justify-center">
                <EmptyState
                  icon={MessageCircle}
                  title="Selecciona una conversación"
                  description="Elige un chat de la lista para ver mensajes y responder."
                />
              </CardBody>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {active?.profile_name || active?.wa_id}
                    </div>
                    <div className="text-xs text-slate-500">{active?.wa_id}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void toggleMode('bot')}>
                      Modo bot
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void toggleMode('human')}>
                      Modo humano
                    </Button>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
                  {messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No hay mensajes aún.</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                          m.direction === 'outbound'
                            ? 'ml-auto bg-brand-600 text-white'
                            : 'bg-white text-slate-800 ring-1 ring-slate-200',
                        )}
                      >
                        {m.body || `[${m.message_type || 'mensaje'}]`}
                        <div className="mt-1 text-[10px] opacity-70">
                          {new Date(m.created_at).toLocaleTimeString()}
                          {m.direction === 'inbound' ? ' · recibido' : ' · enviado'}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-slate-100 p-4">
                  <div className="flex gap-2">
                    <Textarea
                      className="min-h-[44px] flex-1 resize-none"
                      rows={2}
                      placeholder="Escribe una respuesta…"
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
                      onClick={() => void sendReply()}
                      disabled={sending || !reply.trim()}
                      loading={sending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </SectionLayout>
  );
}
