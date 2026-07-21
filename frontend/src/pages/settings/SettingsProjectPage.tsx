import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useProjectSettings } from '../../hooks/useProjectSettings';

export function SettingsProjectPage() {
  const { form, setForm } = useProjectSettings();

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Proyecto</h2>
          <p className="text-sm text-slate-500">Configuración general y ejecución automática</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Nombre del proyecto
          </label>
          <Input
            value={form.project_name}
            onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
            placeholder="Ej. Mi marca, Cliente ABC…"
          />
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
            checked={form.autopilot_enabled}
            onChange={(e) => setForm((f) => ({ ...f, autopilot_enabled: e.target.checked }))}
          />
          <span className="text-sm font-medium text-slate-700">
            Autopilot habilitado para este proyecto
          </span>
        </label>
      </CardBody>
    </Card>
  );
}
