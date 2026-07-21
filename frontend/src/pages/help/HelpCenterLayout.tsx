import { Outlet } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { SectionLayout } from '../../layout/SectionLayout';

export const HELP_TABS = [
  { to: '/help', label: 'Inicio', end: true },
  { to: '/help/faq', label: 'Preguntas frecuentes' },
  { to: '/help/tickets', label: 'Mis tickets' },
  { to: '/help/contact', label: 'Contactar soporte' },
];

export function HelpCenterLayout() {
  return (
    <SectionLayout
      title="Centro de ayuda"
      description="Soporte, tickets y respuestas a las dudas más comunes."
      icon={LifeBuoy}
      tabs={HELP_TABS}
    >
      <Outlet />
    </SectionLayout>
  );
}
