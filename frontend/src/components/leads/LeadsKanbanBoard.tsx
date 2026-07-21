import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone } from 'lucide-react';
import { apiJson } from '../../api/client';
import { Badge } from '../ui/Badge';
import { LEAD_PIPELINE } from '../../lib/leads-pipeline';
import { shortName } from '../../lib/format';
import { cn } from '../../lib/cn';

interface LeadCard {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  status: string;
  needs_website: boolean;
  google_rating: number | null;
  business_type: string | null;
}

interface KanbanData {
  columns: Record<string, LeadCard[]>;
  counts: Record<string, number>;
}

export function LeadsKanbanBoard({ onRefresh }: { onRefresh?: () => void }) {
  const navigate = useNavigate();
  const [data, setData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiJson<KanbanData>('/api/leads/kanban');
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveLead(leadId: string, fromStatus: string, toStatus: string) {
    if (fromStatus === toStatus) return;

    setData((prev) => {
      if (!prev) return prev;
      const lead = prev.columns[fromStatus]?.find((l) => l.id === leadId);
      if (!lead) return prev;
      const columns = { ...prev.columns };
      columns[fromStatus] = columns[fromStatus]!.filter((l) => l.id !== leadId);
      columns[toStatus] = [{ ...lead, status: toStatus }, ...(columns[toStatus] ?? [])];
      const counts = { ...prev.counts };
      counts[fromStatus] = Math.max(0, (counts[fromStatus] ?? 1) - 1);
      counts[toStatus] = (counts[toStatus] ?? 0) + 1;
      return { columns, counts };
    });

    try {
      await apiJson(`/api/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: toStatus }),
      });
      onRefresh?.();
    } catch {
      await load();
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
        Cargando tablero…
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {LEAD_PIPELINE.map((stage) => {
        const cards = data?.columns[stage.key] ?? [];
        const total = data?.counts[stage.key] ?? 0;
        const isOver = overColumn === stage.key;

        return (
          <div
            key={stage.key}
            className={cn(
              'flex w-64 shrink-0 flex-col rounded-2xl border-2 transition',
              stage.color,
              isOver && 'ring-2 ring-brand-400 ring-offset-2',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setOverColumn(stage.key);
            }}
            onDragLeave={() => setOverColumn(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOverColumn(null);
              const leadId = e.dataTransfer.getData('text/lead-id');
              const from = e.dataTransfer.getData('text/from-status');
              if (leadId) void moveLead(leadId, from, stage.key);
              setDraggingId(null);
            }}
          >
            <div className="flex items-center justify-between border-b border-black/5 px-3 py-2.5">
              <h3 className="text-sm font-semibold text-ink">{stage.label}</h3>
              <Badge tone="default">{total}</Badge>
            </div>
            <div className="flex max-h-[calc(100vh-280px)] min-h-[120px] flex-col gap-2 overflow-y-auto p-2">
              {cards.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-muted">Sin leads</p>
              ) : (
                cards.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/lead-id', lead.id);
                      e.dataTransfer.setData('text/from-status', stage.key);
                      setDraggingId(lead.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className={cn(
                      'cursor-grab rounded-xl border border-white/80 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing',
                      draggingId === lead.id && 'opacity-50',
                    )}
                  >
                    <p className="truncate font-medium text-ink">{shortName(lead.name)}</p>
                    {lead.business_type ? (
                      <p className="mt-0.5 truncate text-xs text-ink-muted">{lead.business_type}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {lead.needs_website ? (
                        <Badge tone="warning">Sin web</Badge>
                      ) : null}
                      {lead.google_rating != null ? (
                        <Badge tone="info">★ {lead.google_rating}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-0.5 text-[11px] text-ink-muted">
                      {lead.city ? (
                        <p className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {lead.city}
                        </p>
                      ) : null}
                      {lead.phone ? (
                        <p className="flex items-center gap-1 truncate">
                          <Phone className="h-3 w-3 shrink-0" />
                          {lead.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              {total > cards.length ? (
                <p className="text-center text-[10px] text-ink-muted">
                  +{total - cards.length} más
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
