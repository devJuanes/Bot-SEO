import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Kanban, LayoutList, Search, Users, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Input';
import { LeadsKanbanBoard } from '../components/leads/LeadsKanbanBoard';
import {
  DataTable,
  EmptyState,
  LoadingState,
  TableCell,
  TableRow,
  TableShell,
} from '../components/ui/DataTable';
import { SectionLayout } from '../layout/SectionLayout';
import { shortName, truncate } from '../lib/format';
import { STATUS_LABELS, STATUS_TONES } from '../lib/leads-pipeline';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  source: string;
  status: string;
  business_type: string | null;
  needs_website: boolean;
  google_rating: number | null;
  created_at: string;
}

export function LeadsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<'table' | 'kanban'>('kanban');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      const res = await api(`/api/leads?${params}`);
      const json = (await res.json()) as { leads: Lead[]; total: number };
      setLeads(json.leads || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <SectionLayout
      title="Leads"
      description="Base de contactos y prospectos de tu proyecto."
      icon={Users}
      actions={
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-border-soft bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                view === 'kanban' ? 'bg-brand-50 text-brand-700' : 'text-ink-muted'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                view === 'table' ? 'bg-brand-50 text-brand-700' : 'text-ink-muted'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Tabla
            </button>
          </div>
          <Link to="/automations">
            <Button size="sm" variant="secondary">
              <Workflow className="mr-1.5 h-4 w-4" />
              Automatizaciones
            </Button>
          </Link>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Actualizar
          </Button>
        </div>
      }
    >
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <Field>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, teléfono, ciudad…"
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
            />
          </div>
        </Field>
        <Field>
          <Select
            value={status}
            onChange={(e) => {
              setPage(0);
              setStatus(e.target.value);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="new">Nuevo</option>
            <option value="contacted">Contactado</option>
            <option value="qualified">Calificado</option>
            <option value="won">Ganado</option>
            <option value="lost">Perdido</option>
            <option value="discarded">Descartado</option>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button
            variant="secondary"
            onClick={() => {
              setPage(0);
              void load();
            }}
          >
            Buscar
          </Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <LeadsKanbanBoard onRefresh={() => void load()} />
      ) : loading ? (
        <LoadingState />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay leads"
          description="Aún no hay prospectos con estos filtros. Activa el cazador de leads desde Agentes."
        />
      ) : (
        <>
          <TableShell>
            <DataTable
              columns={[
                { key: 'name', label: 'Nombre', className: 'w-[180px]' },
                { key: 'phone', label: 'Teléfono', className: 'w-[130px]' },
                { key: 'city', label: 'Ciudad', className: 'w-[120px]' },
                { key: 'source', label: 'Fuente', className: 'w-[110px]' },
                { key: 'status', label: 'Estado', className: 'w-[110px]' },
                { key: 'rating', label: 'Rating', className: 'w-[80px]' },
                { key: 'web', label: 'Web', className: 'w-[90px]' },
                { key: 'date', label: 'Creado', className: 'w-[100px]' },
              ]}
            >
              {leads.map((lead) => (
                <TableRow key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}>
                  <TableCell className="max-w-[180px] truncate font-medium text-slate-900" title={lead.name}>
                    {shortName(lead.name)}
                  </TableCell>
                  <TableCell className="max-w-[130px] truncate whitespace-nowrap">
                    {truncate(lead.phone, 16)}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate whitespace-nowrap">
                    {truncate(lead.city, 18)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge tone="info">{truncate(lead.source, 14)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge tone={STATUS_TONES[lead.status] ?? 'default'}>
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{lead.google_rating ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {lead.needs_website ? (
                      <Badge tone="warning">Sin web</Badge>
                    ) : (
                      <Badge tone="success">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          </TableShell>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              {total} leads · página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </SectionLayout>
  );
}
