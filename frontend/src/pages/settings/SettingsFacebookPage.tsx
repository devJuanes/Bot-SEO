import { useEffect, useState } from 'react';
import { ConfiguredSecretSection } from '../../components/settings/ConfiguredSecretSection';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Input';
import { useProjectSettings } from '../../hooks/useProjectSettings';

export function SettingsFacebookPage() {
  const { form, setForm, setSecret, sc } = useProjectSettings();
  const configured = Boolean(sc.facebook_page_access_token && sc.facebook_page_id);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (configured) setEditing(false);
  }, [configured, sc.facebook_page_access_token, sc.facebook_page_id]);

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Facebook</h2>
            <p className="text-sm text-slate-500">Publicación automática en página de Facebook</p>
          </div>
          <Badge tone={configured ? 'success' : 'warning'}>
            {configured ? 'Configurado' : 'Pendiente'}
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={form.facebook_enabled}
              onChange={(e) => setForm((f) => ({ ...f, facebook_enabled: e.target.checked }))}
            />
            <span className="text-sm font-medium text-slate-700">Facebook habilitado</span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={form.facebook_dry_run}
              onChange={(e) => setForm((f) => ({ ...f, facebook_dry_run: e.target.checked }))}
            />
            <span className="text-sm font-medium text-slate-700">Modo dry-run</span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={form.facebook_auto_publish}
              onChange={(e) =>
                setForm((f) => ({ ...f, facebook_auto_publish: e.target.checked }))
              }
            />
            <span className="text-sm font-medium text-slate-700">
              Auto-publicar cuando el agente genera contenido
            </span>
          </label>
        </div>

        <ConfiguredSecretSection
          configured={configured}
          title="Facebook configurado"
          description="Ya está configurado con el Page Access Token y el Page ID."
          editing={editing}
          onStartEdit={() => setEditing(true)}
          onCancelEdit={() => setEditing(false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <label className="mb-1.5 block text-sm font-medium">Page ID</label>
              <Input
                placeholder={sc.facebook_page_id ? '••••' : ''}
                onChange={(e) => setSecret('facebook_page_id', e.target.value)}
              />
            </Field>
            <Field className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Page Access Token</label>
              <Input
                type="password"
                placeholder={sc.facebook_page_access_token ? '••••••••' : ''}
                onChange={(e) => setSecret('facebook_page_access_token', e.target.value)}
              />
            </Field>
          </div>
        </ConfiguredSecretSection>
      </CardBody>
    </Card>
  );
}
