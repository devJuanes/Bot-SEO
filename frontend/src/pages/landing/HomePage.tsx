import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import {
  ORGANIZATION_JSON_LD,
  PageMeta,
  SOFTWARE_JSON_LD,
} from '../../components/seo/PageMeta';
import { Button } from '../../components/ui/Button';
import { HOME_FEATURES, MARQUEE_ITEMS, STATS, STEPS } from './landing-data';
import { ProductPreview } from './ProductPreview';

export function HomePage() {
  return (
    <>
      <PageMeta
        title="MatuByte Growth Factory"
        description="Plataforma SaaS con agentes de IA para prospección, WhatsApp, Facebook, automatizaciones y monitor en vivo. Multi-tenant para equipos en Latinoamérica."
        path="/"
        jsonLd={[ORGANIZATION_JSON_LD, SOFTWARE_JSON_LD]}
      />

      {/* Hero — una composición: marca + headline + CTA + visual */}
      <section className="relative overflow-hidden">
        <div className="landing-glow pointer-events-none absolute inset-0" />
        <div className="landing-grid pointer-events-none absolute inset-0 opacity-60" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:pb-20 sm:pt-16 lg:grid-cols-2 lg:gap-14 lg:pb-28 lg:pt-20">
          <div className="landing-fade-up">
            <p
              className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl"
              style={{ letterSpacing: '-0.03em' }}
            >
              Growth
              <br />
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-700 bg-clip-text text-transparent">
                Factory
              </span>
            </p>
            <h1 className="mt-5 max-w-xl text-2xl font-semibold leading-snug tracking-tight text-ink/90 sm:text-3xl">
              Agentes de IA que prospectan, escriben y operan tu growth
            </h1>
            <p className="landing-fade-up landing-fade-up-delay-1 mt-5 max-w-lg text-base leading-relaxed text-ink-muted sm:text-lg">
              Prospección, WhatsApp, Facebook y automatizaciones en un solo cockpit — con tu marca y
              control humano en cada paso.
            </p>

            <div className="landing-fade-up landing-fade-up-delay-2 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/acceso/crear-cuenta">
                <Button size="lg" className="gap-2 px-7">
                  Empezar gratis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/como-funciona">
                <Button size="lg" variant="secondary">
                  Ver cómo funciona
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-muted">
              Sin tarjeta · Multi-proyecto · Datos en tu MatuDB
            </p>
          </div>

          <div className="landing-fade-up landing-fade-up-delay-1">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Marquee */}
      <section className="border-y border-border-soft bg-white py-4 overflow-hidden" aria-hidden>
        <div className="landing-marquee flex w-max gap-10 whitespace-nowrap">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="inline-flex items-center gap-3 text-sm font-semibold text-ink-muted"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border-soft bg-surface" aria-label="Ventajas">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.value}>
              <p className="font-display text-2xl font-bold tracking-tight text-brand-600 sm:text-3xl">
                {s.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features band */}
      <section className="border-b border-border-soft bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-600">
              <Sparkles className="h-4 w-4" />
              Qué incluye
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Todo el growth en un solo lugar
            </h2>
            <p className="mt-3 text-base text-ink-muted sm:text-lg">
              Deja de armar el pipeline con herramientas sueltas. Growth Factory une agentes,
              mensajería y automatización.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {HOME_FEATURES.map((f, i) => (
              <div key={f.title} className="border-t border-border-soft pt-6">
                <p className="font-display text-xs font-bold uppercase tracking-widest text-brand-500">
                  0{i + 1}
                </p>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              to="/funciones"
              className="inline-flex items-center gap-2 text-sm font-bold text-brand-600 transition hover:text-brand-700"
            >
              Ver todas las funciones
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Dark value prop */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-end">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Hecho para equipos que venden en Latinoamérica
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-white/65">
                Cada proyecto es un tenant aislado: marca, secretos, WhatsApp y agentes propios. Tú
                apruebas campañas y posts antes de que salgan.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                'Aprobación humana en Facebook y campañas',
                'Monitor en vivo de lo que hacen tus agentes',
                'Flujos visuales sin código',
                'Datos en tu base MatuDB',
              ].map((line) => (
                <li key={line} className="flex gap-3 text-sm text-white/85">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="border-b border-border-soft bg-surface scroll-mt-24">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Cómo funciona
            </h2>
            <p className="mt-3 text-base text-ink-muted sm:text-lg">
              De la cuenta al primer agente en cuatro pasos claros.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n}>
                <p className="font-display text-4xl font-extrabold tracking-tight text-brand-200">
                  {step.n}
                </p>
                <h3 className="mt-3 text-base font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="landing-pulse-ring absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
          <div
            className="landing-pulse-ring absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25"
            style={{ animationDelay: '0.8s' }}
          />
        </div>
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-24">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Empieza a hacer crecer tu pipeline hoy
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/80">
            Crea tu cuenta, configura tu marca y activa tu primer agente en minutos.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/acceso/crear-cuenta">
              <Button
                size="lg"
                className="gap-2 border-0 bg-white px-8 text-brand-700 shadow-lg hover:bg-brand-50"
              >
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contacto">
              <Button
                size="lg"
                variant="secondary"
                className="border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                Hablar con nosotros
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
