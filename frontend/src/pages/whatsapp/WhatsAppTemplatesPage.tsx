import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { api, apiJson } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Input';
import {
  DataTable,
  EmptyState,
  LoadingState,
  TableCell,
  TableRow,
  TableShell,
} from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { SectionLayout } from '../../layout/SectionLayout';

const WA_TABS = [
  { to: '/whatsapp/mensajes', label: 'Mensajes' },
  { to: '/whatsapp/campaigns', label: 'Campañas' },
  { to: '/whatsapp/contacts', label: 'Contactos' },
  { to: '/whatsapp/templates', label: 'Plantillas' },
];

interface Template {
  name: string;
  language: string;
  status: string;
}

export function WhatsAppTemplatesPage() {
  const navigate = useNavigate();
  const [configured, setConfigured] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorModal, setErrorModal] = useState('');
  const [okModal, setOkModal] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const waStatus = await apiJson<{ configured: boolean }>('/api/whatsapp/status');
      setConfigured(waStatus.configured);
      if (!waStatus.configured) {
        setTemplates([]);
        setError('');
        return;
      }
      const tpl = await apiJson<{ templates: Template[] }>('/api/whatsapp/templates');
      setTemplates(tpl.templates || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleTestSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const bodyParams = String(form.get('bodyParams') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await api('/api/whatsapp/templates/test', {
      method: 'POST',
      body: JSON.stringify({
        to: form.get('to'),
        templateName: form.get('templateName'),
        templateLanguage: form.get('templateLanguage') || 'es',
        bodyParams,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorModal((data as { error?: string }).error || `Error ${res.status}`);
      return;
    }
    setOkModal('Prueba enviada. Revisa WhatsApp.');
  }

  return (
    <SectionLayout
      title="WhatsApp"
      description="Plantillas aprobadas en Meta y envío de prueba a un número."
      icon={MessageCircle}
      tabs={WA_TABS}
    >
      {!configured && !loading ? (
        <EmptyState
          icon={MessageCircle}
          title="WhatsApp no configurado"
          description="Conecta la Cloud API de Meta en Ajustes → WhatsApp para ver plantillas y enviar pruebas."
          action={
            <Button onClick={() => navigate('/settings/whatsapp')}>Ir a ajustes</Button>
          }
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-4 font-semibold text-slate-900">Enviar prueba</h2>
            <form className="space-y-4" onSubmit={handleTestSubmit} autoComplete="off">
              <Field>
                <label className="mb-1.5 block text-sm font-medium">WhatsApp con país</label>
                <Input name="to" defaultValue="573023580862" required />
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
                <Input name="bodyParams" defaultValue="Juan" />
              </Field>
              <Button type="submit">Enviar prueba</Button>
            </form>
          </CardBody>
        </Card>

        <div>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : (
            <TableShell>
              <DataTable
                columns={[
                  { key: 'name', label: 'Plantilla' },
                  { key: 'lang', label: 'Idioma' },
                  { key: 'status', label: 'Estado' },
                ]}
              >
                {templates.map((t) => (
                  <TableRow key={`${t.name}-${t.language}`}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.language}</TableCell>
                    <TableCell>
                      <Badge tone={t.status === 'APPROVED' ? 'success' : 'warning'}>
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            </TableShell>
          )}
        </div>
      </div>
      )}

      <Modal open={Boolean(errorModal)} onClose={() => setErrorModal('')} title="Error">
        <p className="text-sm text-ink-muted">{errorModal}</p>
      </Modal>
      <Modal open={Boolean(okModal)} onClose={() => setOkModal('')} title="Listo">
        <p className="text-sm text-ink-muted">{okModal}</p>
      </Modal>
    </SectionLayout>
  );
}
