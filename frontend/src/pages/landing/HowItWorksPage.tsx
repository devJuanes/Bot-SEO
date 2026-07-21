import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageMeta } from '../../components/seo/PageMeta';
import { Button } from '../../components/ui/Button';
import { STEPS } from './landing-data';

export function HowItWorksPage() {
  return (
    <>
      <PageMeta
        title="Cómo funciona"
        description="De cero a growth en 4 pasos: crea tu cuenta, configura marca e integraciones, activa agentes y flujos, opera leads y campañas desde un solo cockpit."
        path="/como-funciona"
      />

      <section className="border-b border-border-soft bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            Cómo funciona
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            De cero a growth en 4 pasos
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted">
            Growth Factory está pensado para que un equipo pequeño pueda operar prospección,
            mensajería y contenido sin depender de cinco herramientas distintas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <ol className="grid gap-8 md:grid-cols-2">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="relative rounded-3xl border border-border-soft bg-white p-6 shadow-sm"
            >
              <span className="text-4xl font-bold text-brand-100" aria-hidden>
                {step.n}
              </span>
              <h2 className="mt-2 text-xl font-semibold text-ink">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-border-soft bg-gradient-to-b from-white to-surface">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-bold">Flujo típico de un día</h2>
          <div className="mt-8 space-y-4">
            {[
              'Por la mañana Lead Hunter agrega prospectos nuevos al Kanban.',
              'Un flujo automático envía el primer WhatsApp con plantilla aprobada.',
              'Tu equipo responde desde el inbox o deja el modo bot activo.',
              'Social Creator genera un post; tú lo apruebas en la cola de Facebook.',
              'El monitor muestra qué agentes están trabajando en tiempo real.',
            ].map((line, i) => (
              <div
                key={line}
                className="flex gap-4 rounded-2xl border border-border-soft bg-white px-5 py-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 text-center">
        <Link to="/acceso/crear-cuenta">
          <Button size="lg" className="gap-2 px-8">
            Empezar ahora
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>
    </>
  );
}
