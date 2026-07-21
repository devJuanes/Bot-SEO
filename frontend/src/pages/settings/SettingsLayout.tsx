import { Outlet } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SectionLayout } from '../../layout/SectionLayout';
import { SettingsProvider, useProjectSettings } from '../../hooks/useProjectSettings';

const SETTINGS_TABS = [
  { to: '/settings/project', label: 'Proyecto' },
  { to: '/settings/llm', label: 'LLM / IA' },
  { to: '/settings/whatsapp', label: 'WhatsApp' },
  { to: '/settings/facebook', label: 'Facebook' },
  { to: '/settings/brand', label: 'Marca' },
];

function SettingsShell() {
  const { data, saving, save, toast } = useProjectSettings();

  return (
    <SectionLayout
      title="Ajustes"
      description={
        data?.project?.name
          ? `Proyecto: ${data.project.name} · integraciones y credenciales`
          : 'Configura tu proyecto SaaS'
      }
      icon={Settings}
      tabs={SETTINGS_TABS}
      actions={
        <Button size="sm" loading={saving} onClick={() => void save()}>
          Guardar cambios
        </Button>
      }
    >
      <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <Outlet />
      </form>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </SectionLayout>
  );
}

export function SettingsLayout() {
  return (
    <SettingsProvider>
      <SettingsShell />
    </SettingsProvider>
  );
}
