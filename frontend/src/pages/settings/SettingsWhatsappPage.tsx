import { useEffect, useState } from 'react';
import { ConfiguredSecretSection } from '../../components/settings/ConfiguredSecretSection';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Input';
import { useProjectSettings } from '../../hooks/useProjectSettings';

export function SettingsWhatsappPage() {
  const { form, setForm, setSecret, sc } = useProjectSettings();
  const configured = Boolean(sc.whatsapp_access_token && sc.whatsapp_phone_number_id);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (configured) setEditing(false);
  }, [configured, sc.whatsapp_access_token, sc.whatsapp_phone_number_id]);

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">WhatsApp</h2>
            <p className="text-sm text-slate-500">Cloud API de Meta para mensajería</p>
          </div>
          <Badge tone={configured ? 'success' : 'warning'}>
            {configured ? 'Configurado' : 'Pendiente'}
          </Badge>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
            checked={form.whatsapp_enabled}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp_enabled: e.target.checked }))}
          />
          <span className="text-sm font-medium text-slate-700">WhatsApp habilitado</span>
        </label>

        <ConfiguredSecretSection
          configured={configured}
          title="WhatsApp configurado"
          description="Ya está configurado con el token de acceso y el Phone Number ID."
          editing={editing}
          onStartEdit={() => setEditing(true)}
          onCancelEdit={() => setEditing(false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <label className="mb-1.5 block text-sm font-medium">Phone Number ID</label>
              <Input
                placeholder={sc.whatsapp_phone_number_id ? '••••' : ''}
                onChange={(e) => setSecret('whatsapp_phone_number_id', e.target.value)}
              />
            </Field>
            <Field>
              <label className="mb-1.5 block text-sm font-medium">Business Account ID</label>
              <Input
                placeholder={
                  sc.whatsapp_business_account_id ? '••••' : 'Opcional — se detecta solo'
                }
                onChange={(e) => setSecret('whatsapp_business_account_id', e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Solo necesario si la detección automática falla. Para enviar mensajes basta con Token
                y Phone Number ID.
              </p>
            </Field>
            <Field className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Access Token</label>
              <Input
                type="password"
                placeholder={sc.whatsapp_access_token ? '••••••••' : ''}
                onChange={(e) => setSecret('whatsapp_access_token', e.target.value)}
              />
            </Field>
            <Field>
              <label className="mb-1.5 block text-sm font-medium">Verify Token (webhook)</label>
              <Input
                type="password"
                placeholder={sc.whatsapp_verify_token ? '••••' : ''}
                onChange={(e) => setSecret('whatsapp_verify_token', e.target.value)}
              />
            </Field>
            <Field>
              <label className="mb-1.5 block text-sm font-medium">Teléfono del dueño</label>
              <Input
                placeholder={sc.whatsapp_owner_phone ? '••••' : ''}
                onChange={(e) => setSecret('whatsapp_owner_phone', e.target.value)}
              />
            </Field>
          </div>
        </ConfiguredSecretSection>

        <div className="grid gap-4 md:grid-cols-2">
          <Field className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">URL CTA</label>
            <Input
              type="url"
              value={form.whatsapp_cta_url}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp_cta_url: e.target.value }))}
            />
          </Field>
          <Field className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Palabras de handoff (coma)</label>
            <Input
              value={form.whatsapp_handoff_keywords}
              onChange={(e) =>
                setForm((f) => ({ ...f, whatsapp_handoff_keywords: e.target.value }))
              }
            />
          </Field>
        </div>
      </CardBody>
    </Card>
  );
}
