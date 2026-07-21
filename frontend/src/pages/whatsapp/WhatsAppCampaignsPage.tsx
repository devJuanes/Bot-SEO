import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search } from 'lucide-react';
import { api, apiJson } from '../../api/client';
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
import { GateModal, Modal } from '../../components/ui/Modal';
import { SectionLayout } from '../../layout/SectionLayout';
import { useSetup } from '../../hooks/useSetup';
import { usePolling } from '../../hooks/usePolling';
import { truncate } from '../../lib/format';

const WA_TABS = [
  { to: '/whatsapp/mensajes', label: 'Mensajes' },
  { to: '/whatsapp/campaigns', label: 'Campañas' },
  { to: '/whatsapp/contacts', label: 'Contactos' },
  { to: '/whatsapp/templates', label: 'Plantillas' },
];

interface Campaign {
  id: string;
  name: string;
  template_name: string;
  template_language: string;
  status: string;
  sent_count: number;
  total_targets: number;
  failed_count: number;
}

export function WhatsAppCampaignsPage() {
  const navigate = useNavigate();
  const { status } = useSetup();
  const [configured, setConfigured] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [errorModal, setErrorModal] = useState('');
  const [okModal, setOkModal] = useState('');
  const [gateWa, setGateWa] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    try {
      const waStatus = await apiJson<{ configured: boolean }>('/api/whatsapp/status');
      setConfigured(waStatus.configured);
      if (!waStatus.configured) {
        setCampaigns([]);
        return;
      }
      const camp = await apiJson<{ campaigns: Campaign[] }>('/api/whatsapp/campaigns');
      setCampaigns(camp.campaigns || []);
    } catch (e) {
      if (!silent) {
        setErrorModal(e instanceof Error ? e.message : 'Error al cargar campañas');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(() => void refresh(true), 30_000, true, false);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.template_name.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
      );
    });
  }, [campaigns, search, statusFilter]);

  async function handleCampaignSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status && !status.whatsappConfigured) {
      setGateWa(true);
      return;
    }
    const form = new FormData(e.currentTarget);
    const bodyParams = String(form.get('bodyParams') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const leadFilter: Record<string, string> = {};
    const sector = String(form.get('sector') || '').trim();
    const city = String(form.get('city') || '').trim();
    if (sector) leadFilter.sector = sector;
    if (city) leadFilter.city = city;

    const res = await api('/api/whatsapp/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        templateName: form.get('templateName'),
        templateLanguage: String(form.get('templateLanguage') || 'es'),
        appSlug: form.get('appSlug') || undefined,
        bodyParamsTemplate: bodyParams,
        leadFilter,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorModal((data as { error?: string }).error || `Error ${res.status}`);
      return;
    }
    setShowForm(false);
    setOkModal('Campaña creada correctamente.');
    e.currentTarget.reset();
    await refresh();
  }

  async function cancelCampaign(id: string) {
    await api(`/api/whatsapp/campaigns/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    setCancelId(null);
    await refresh();
  }

  return (
    <SectionLayout
      title="WhatsApp"
      description="Campañas masivas con plantillas aprobadas por Meta."
      icon={MessageCircle}
      tabs={WA_TABS}
      actions={
        <Button
          size="sm"
          onClick={() => {
            if (status && !status.whatsappConfigured) {
              setGateWa(true);
              return;
            }
            setShowForm(true);
          }}
        >
          Nueva campaña
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Field className="min-w-[200px] flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar campaña o plantilla…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </Field>
        <Field>
          <select
            className="h-10 rounded-2xl border border-border-soft bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="draft">draft</option>
            <option value="sending">sending</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
            <option value="failed">failed</option>
          </select>
        </Field>
      </div>

      {loading ? (
        <LoadingState />
      ) : !configured ? (
        <EmptyState
          icon={MessageCircle}
          title="WhatsApp no configurado"
          description="Añade Access Token y Phone Number ID en Ajustes → WhatsApp para crear campañas."
          action={
            <Button onClick={() => navigate('/settings/whatsapp')}>Ir a ajustes</Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No hay campañas"
          description="Crea una campaña con plantilla Meta para contactar leads."
          action={<Button onClick={() => setShowForm(true)}>Nueva campaña</Button>}
        />
      ) : (
        <TableShell>
          <DataTable
            columns={[
              { key: 'name', label: 'Campaña' },
              { key: 'template', label: 'Plantilla' },
              { key: 'status', label: 'Estado' },
              { key: 'progress', label: 'Progreso' },
              { key: 'actions', label: '' },
            ]}
          >
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="max-w-[200px] truncate font-medium" title={c.name}>
                  {truncate(c.name, 32)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {truncate(c.template_name, 20)} / {c.template_language}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge tone={c.status === 'completed' ? 'success' : 'brand'}>{c.status}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.sent_count}/{c.total_targets} · fail {c.failed_count}
                </TableCell>
                <TableCell>
                  {c.status === 'sending' && (
                    <Button size="sm" variant="secondary" onClick={() => setCancelId(c.id)}>
                      Cancelar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </TableShell>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva campaña" size="lg">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCampaignSubmit}>
          <Field className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Nombre</label>
            <Input name="name" required />
          </Field>
          <Field>
            <label className="mb-1.5 block text-sm font-medium">Plantilla</label>
            <Input name="templateName" defaultValue="contacto_cliente" required />
          </Field>
          <Field>
            <label className="mb-1.5 block text-sm font-medium">Idioma</label>
            <Input name="templateLanguage" defaultValue="es" />
          </Field>
          <Field>
            <label className="mb-1.5 block text-sm font-medium">Params (coma)</label>
            <Input name="bodyParams" defaultValue="{{name}}" />
          </Field>
          <Field>
            <label className="mb-1.5 block text-sm font-medium">Sector (filtro)</label>
            <Input name="sector" placeholder="peluquerias" />
          </Field>
          <Field>
            <label className="mb-1.5 block text-sm font-medium">Ciudad (filtro)</label>
            <Input name="city" placeholder="Cali" />
          </Field>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit">Lanzar campaña</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(cancelId)}
        onClose={() => setCancelId(null)}
        title="Cancelar campaña"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelId(null)}>
              No
            </Button>
            <Button onClick={() => cancelId && void cancelCampaign(cancelId)}>Sí, cancelar</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">¿Seguro que quieres cancelar esta campaña en curso?</p>
      </Modal>

      <Modal open={Boolean(errorModal)} onClose={() => setErrorModal('')} title="Error">
        <p className="text-sm text-ink-muted">{errorModal}</p>
      </Modal>
      <Modal open={Boolean(okModal)} onClose={() => setOkModal('')} title="Listo">
        <p className="text-sm text-ink-muted">{okModal}</p>
      </Modal>

      <GateModal
        open={gateWa}
        onClose={() => setGateWa(false)}
        title="WhatsApp no configurado"
        message="Configura Access Token y Phone Number ID antes de enviar campañas."
        ctaLabel="Ir a WhatsApp"
        ctaTo="/settings/whatsapp"
      />
    </SectionLayout>
  );
}
