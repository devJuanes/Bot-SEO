import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input, Textarea } from '../../components/ui/Input';
import { useProjectSettings } from '../../hooks/useProjectSettings';

export function SettingsBrandPage() {
  const { form, setForm } = useProjectSettings();

  return (
    <Card>
      <CardBody className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Marca</h2>
          <p className="text-sm text-slate-500">
            Identidad y conocimiento de marca que usan los agentes al generar contenido
          </p>
        </div>
        <Field>
          <label className="mb-1.5 block text-sm font-medium">Nombre de marca</label>
          <Input
            value={form.brand_name}
            onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))}
            placeholder="MatuByte"
          />
        </Field>
        <Field>
          <label className="mb-1.5 block text-sm font-medium">Conocimiento de marca</label>
          <Textarea
            value={form.brand_knowledge}
            onChange={(e) => setForm((f) => ({ ...f, brand_knowledge: e.target.value }))}
            placeholder="Describe tu empresa, tono, productos, público objetivo…"
            rows={8}
          />
        </Field>
      </CardBody>
    </Card>
  );
}
