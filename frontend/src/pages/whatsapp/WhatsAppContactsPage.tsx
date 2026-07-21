import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { api } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import {
  DataTable,
  EmptyState,
  LoadingState,
  TableCell,
  TableRow,
  TableShell,
} from '../../components/ui/DataTable';
import { SectionLayout } from '../../layout/SectionLayout';
import { shortName, truncate } from '../../lib/format';

const WA_TABS = [
  { to: '/whatsapp/mensajes', label: 'Mensajes' },
  { to: '/whatsapp/campaigns', label: 'Campañas' },
  { to: '/whatsapp/contacts', label: 'Contactos' },
  { to: '/whatsapp/templates', label: 'Plantillas' },
];

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  status: string;
  business_type: string | null;
}

export function WhatsAppContactsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (search.trim()) params.set('search', search.trim());
      const res = await api(`/api/leads?${params}`);
      const json = (await res.json()) as { leads: Lead[]; total: number };
      setLeads((json.leads || []).filter((l) => l.phone));
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SectionLayout
      title="WhatsApp"
      description="Contactos con teléfono disponibles para campañas y seguimiento."
      icon={MessageCircle}
      tabs={WA_TABS}
      actions={
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          Actualizar
        </Button>
      }
    >
      <div className="mb-5 flex gap-3">
        <Field className="flex-1">
          <Input
            placeholder="Buscar contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Button variant="secondary" onClick={() => void load()}>
          Buscar
        </Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No hay contactos"
          description="No hay leads con teléfono en este proyecto."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {total} leads en total · mostrando contactos con teléfono
          </p>
          <TableShell>
            <DataTable
              columns={[
                { key: 'name', label: 'Nombre' },
                { key: 'phone', label: 'WhatsApp' },
                { key: 'city', label: 'Ciudad' },
                { key: 'sector', label: 'Sector' },
                { key: 'status', label: 'Estado' },
              ]}
            >
              {leads.map((lead) => (
                <TableRow key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}>
                  <TableCell className="max-w-[180px] truncate font-medium" title={lead.name}>
                    {shortName(lead.name)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{truncate(lead.phone, 16)}</TableCell>
                  <TableCell className="max-w-[120px] truncate whitespace-nowrap">
                    {truncate(lead.city, 18)}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate whitespace-nowrap">
                    {truncate(lead.business_type, 22)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge tone="brand">{lead.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          </TableShell>
        </>
      )}
    </SectionLayout>
  );
}
