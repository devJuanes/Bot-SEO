import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  LifeBuoy,
  Mail,
  MessageSquare,
  Ticket,
} from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { HELP_FAQ, HELP_QUICK_LINKS } from '../../data/help-faq';

const HIGHLIGHTS = [
  {
    icon: BookOpen,
    title: 'Preguntas frecuentes',
    description: 'Respuestas rápidas sobre agentes, WhatsApp, Facebook y más.',
    to: '/help/faq',
    tone: 'bg-sky-50 text-sky-700',
  },
  {
    icon: Ticket,
    title: 'Mis tickets',
    description: 'Consulta el estado de tus solicitudes de soporte.',
    to: '/help/tickets',
    tone: 'bg-amber-50 text-amber-800',
  },
  {
    icon: Mail,
    title: 'Contactar soporte',
    description: 'Abre un ticket y te respondemos por email o en la plataforma.',
    to: '/help/contact',
    tone: 'bg-brand-50 text-brand-700',
  },
];

export function HelpHomePage() {
  const previewFaq = HELP_FAQ.slice(0, 4);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-brand-100 bg-gradient-to-br from-brand-50/80 to-white">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/25">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">¿En qué podemos ayudarte?</h2>
              <p className="mt-1 max-w-xl text-sm text-ink-muted">
                Encuentra guías, preguntas frecuentes o abre un ticket. El equipo MatuByte
                revisa las solicitudes en horario laboral (L–V, 9:00–18:00 COT).
              </p>
            </div>
          </div>
          <Link
            to="/help/contact"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Abrir ticket
          </Link>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="group">
              <Card className="h-full transition hover:border-brand-200 hover:shadow-md">
                <CardBody className="space-y-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink group-hover:text-brand-600">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-ink-muted">{item.description}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                    Ver más
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-ink">Accesos rápidos</h3>
            <ul className="space-y-2">
              {HELP_QUICK_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="flex items-center justify-between rounded-xl border border-border-soft px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink">{link.title}</div>
                      <div className="text-xs text-ink-muted">{link.description}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-ink">FAQ destacadas</h3>
              <Link to="/help/faq" className="text-xs font-medium text-brand-600 hover:underline">
                Ver todas
              </Link>
            </div>
            <ul className="space-y-3">
              {previewFaq.map((item) => (
                <li key={item.id} className="rounded-xl bg-surface px-4 py-3">
                  <p className="text-sm font-medium text-ink">{item.question}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                    {item.answer}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <MessageSquare className="h-8 w-8 text-brand-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">¿Necesitas ayuda personalizada?</p>
            <p className="text-sm text-ink-muted">
              Escríbenos a{' '}
              <a href="mailto:soporte@matubyte.com" className="text-brand-600 hover:underline">
                soporte@matubyte.com
              </a>{' '}
              o abre un ticket desde la plataforma.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
