import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageMeta } from '../../components/seo/PageMeta';
import { Button } from '../../components/ui/Button';
import { FEATURE_MODULES } from './landing-data';

export function FeaturesPage() {
  return (
    <>
      <PageMeta
        title="Funciones"
        description="Lead Hunter, Kanban de leads, flujos automatizados, WhatsApp inbox y campañas, Facebook con cola de aprobación, agentes de IA, monitor en vivo, dashboard y chat de empresa."
        path="/funciones"
      />

      <section className="border-b border-border-soft bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            Funcionalidades
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Todo lo que Growth Factory hace por tu equipo
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
            No es un mockup: cada módulo está conectado a APIs reales, webhooks de Meta, agentes de
            IA y tu base de datos MatuDB. Esto es lo que encontrarás dentro del cockpit.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-6">
          {FEATURE_MODULES.map((f) => (
            <article
              key={f.title}
              className="group overflow-hidden rounded-3xl border border-border-soft bg-white p-6 shadow-sm transition hover:border-brand-200 hover:shadow-md sm:p-8"
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                  <f.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-ink">{f.title}</h2>
                    <span className="rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      {f.tag}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.body}</p>
                  <ul className="mt-4 space-y-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-sm text-ink">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border-soft bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 text-center">
          <h2 className="text-2xl font-bold">¿Listo para probarlo?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Crea tu cuenta y activa Lead Hunter, WhatsApp o Facebook en minutos.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/acceso/crear-cuenta">
              <Button className="gap-2">
                Crear cuenta
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/como-funciona">
              <Button variant="secondary">Ver cómo funciona</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
