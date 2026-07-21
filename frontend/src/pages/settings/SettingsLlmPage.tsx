import { useEffect, useState } from 'react';
import { ConfiguredSecretSection } from '../../components/settings/ConfiguredSecretSection';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input, Select } from '../../components/ui/Input';
import { useProjectSettings } from '../../hooks/useProjectSettings';

export function SettingsLlmPage() {
  const { form, setForm, setSecret, sc } = useProjectSettings();
  const configured = Boolean(sc.llm_api_key && form.llm_model && form.llm_base_url);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (configured) setEditing(false);
  }, [configured, sc.llm_api_key, form.llm_model, form.llm_base_url]);

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">LLM / IA</h2>
            <p className="text-sm text-slate-500">Proveedor de inteligencia artificial para agentes</p>
          </div>
          <Badge tone={configured ? 'success' : 'warning'}>
            {configured ? 'Configurado' : 'Pendiente'}
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <label className="mb-1.5 block text-sm font-medium">Proveedor</label>
            <Select
              value={form.llm_provider}
              onChange={(e) => setForm((f) => ({ ...f, llm_provider: e.target.value }))}
            >
              <option value="minimax">MiniMax</option>
            </Select>
          </Field>
          <Field>
            <label className="mb-1.5 block text-sm font-medium">Modelo</label>
            <Input
              value={form.llm_model}
              onChange={(e) => setForm((f) => ({ ...f, llm_model: e.target.value }))}
              placeholder="MiniMax-M2.1"
            />
          </Field>
          <Field className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Base URL</label>
            <Input
              type="url"
              value={form.llm_base_url}
              onChange={(e) => setForm((f) => ({ ...f, llm_base_url: e.target.value }))}
              placeholder="https://api.minimax.io/v1"
            />
          </Field>
        </div>

        <ConfiguredSecretSection
          configured={Boolean(sc.llm_api_key)}
          title="API key configurada"
          description="Ya está configurado con la API key. Los demás campos se pueden editar arriba."
          editing={editing}
          onStartEdit={() => setEditing(true)}
          onCancelEdit={() => setEditing(false)}
        >
          <Field>
            <label className="mb-1.5 block text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder={sc.llm_api_key ? '••••••••' : 'Pega tu API key'}
              onChange={(e) => setSecret('llm_api_key', e.target.value)}
            />
          </Field>
        </ConfiguredSecretSection>
      </CardBody>
    </Card>
  );
}
