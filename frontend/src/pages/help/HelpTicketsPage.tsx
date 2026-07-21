import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Ticket } from 'lucide-react';
import { apiJson } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, LoadingState } from '../../components/ui/DataTable';
import { formatDateTime } from '../../lib/format';

interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, { label: string; tone: 'brand' | 'warning' | 'success' | 'default' }> = {
  open: { label: 'Abierto', tone: 'brand' },
  in_progress: { label: 'En progreso', tone: 'warning' },
  resolved: { label: 'Resuelto', tone: 'success' },
  closed: { label: 'Cerrado', tone: 'default' },
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  technical: 'Técnico',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  billing: 'Facturación',
  feature: 'Funcionalidad',
};

export function HelpTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiJson<{ tickets: SupportTicket[]; openCount: number }>(
        '/api/support/tickets',
      );
      setTickets(data.tickets || []);
      setOpenCount(data.openCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Cargando tickets…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-ink-muted">
            {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
          </p>
          {openCount > 0 ? <Badge tone="warning">{openCount} abiertos</Badge> : null}
        </div>
        <Link to="/help/contact">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </Button>
        </Link>
      </div>

      {error ? (
        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{error}</p>
      ) : null}

      {tickets.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No tienes tickets aún"
          description="Cuando abras una solicitud de soporte aparecerá aquí con su estado."
          action={
            <Link to="/help/contact">
              <Button>Crear primer ticket</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const status = STATUS_LABELS[ticket.status] ?? STATUS_LABELS.open;
            const isOpen = expanded === ticket.id;
            return (
              <Card key={ticket.id} className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : ticket.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <Badge>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</Badge>
                    </div>
                    <h3 className="font-semibold text-ink">{ticket.subject}</h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatDateTime(ticket.created_at)}
                    </p>
                  </div>
                </button>
                {isOpen ? (
                  <div className="space-y-3 border-t border-border-soft px-5 pb-4 pt-3">
                    <div>
                      <p className="text-xs font-medium text-ink-muted">Tu mensaje</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{ticket.message}</p>
                    </div>
                    {ticket.admin_reply ? (
                      <div className="rounded-xl bg-brand-50 px-4 py-3">
                        <p className="text-xs font-medium text-brand-700">Respuesta de soporte</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                          {ticket.admin_reply}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-ink-muted">
                        Estamos revisando tu solicitud. Te notificaremos cuando haya respuesta.
                      </p>
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
