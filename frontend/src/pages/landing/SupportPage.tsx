import { Link } from 'react-router-dom';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { PageMeta } from '../../components/seo/PageMeta';
import { Button } from '../../components/ui/Button';
import { FAQ_ITEMS, SETUP_GUIDES } from './landing-data';

export function SupportPage() {
  return (
    <>
      <PageMeta
        title="Soporte y ayuda"
        description="Preguntas frecuentes sobre MatuByte Growth Factory: WhatsApp, Facebook, agentes, multi-tenant y cómo empezar. Guías de configuración y contacto."
        path="/soporte"
      />

      <section className="border-b border-border-soft bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Soporte</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Centro de ayuda
          </h1>
          <p className="mt-4 max-w-2xl text-base text-ink-muted">
            Respuestas a lo más consultado y guías para configurar tu primer proyecto. Si ya eres
            cliente, también puedes abrir tickets desde el cockpit en /help.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <HelpCircle className="h-6 w-6 text-brand-600" />
          Preguntas frecuentes
        </h2>
        <div className="mt-8 space-y-4">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-border-soft bg-white px-5 py-4 open:shadow-sm"
            >
              <summary className="cursor-pointer list-none font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-border-soft bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-bold">Guías de configuración</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Pasos recomendados después de crear tu cuenta.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {SETUP_GUIDES.map((guide) => (
              <article
                key={guide.title}
                className="rounded-2xl border border-border-soft bg-white p-5"
              >
                <h3 className="font-semibold text-ink">{guide.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{guide.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-3xl border border-brand-200 bg-brand-50/50 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold">¿Necesitas más ayuda?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Si aún no tienes cuenta o quieres una demo guiada, escríbenos por el formulario de
            contacto.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/contacto">
              <Button className="gap-2">
                Ir a contacto
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/acceso/iniciar-sesion">
              <Button variant="secondary">Iniciar sesión</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
