import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Zap } from 'lucide-react';
import {
  ORGANIZATION_JSON_LD,
  PageMeta,
  SOFTWARE_JSON_LD,
} from '../../components/seo/PageMeta';
import { Button } from '../../components/ui/Button';
import { STATS } from './landing-data';
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

      <section className="relative overflow-hidden border-b border-border-soft">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 80% 0%, rgba(225,29,72,0.14), transparent 50%), radial-gradient(ellipse 60% 50% at 0% 100%, rgba(225,29,72,0.08), transparent 45%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="mb-4 inline-flex items-center rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 text-xs font-semibold text-brand-700">
              Plataforma SaaS · Agentes + Growth
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
              Haz crecer tu negocio con{' '}
              <span className="bg-gradient-to-r from-brand-600 to-rose-500 bg-clip-text text-transparent">
                agentes que trabajan
              </span>{' '}
              por ti
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
              MatuByte Growth Factory orquesta prospección, WhatsApp, Facebook y automatizaciones
              en un solo cockpit — con tu marca, datos reales y control humano en cada paso.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/acceso/crear-cuenta">
                <Button className="gap-2 px-6">
                  Empezar gratis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/funciones">
                <Button variant="secondary">Ver funciones</Button>
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
              {['Sin tarjeta para probar', 'Multi-proyecto', 'Datos en tu DB'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="border-b border-border-soft bg-white" aria-label="Ventajas principales">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.value} className="text-center sm:text-left">
              <p className="text-lg font-bold text-brand-600">{s.value}</p>
              <p className="mt-1 text-sm text-ink-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2 text-brand-300">
              <Zap className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Por qué MatuByte</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Deja de armar el growth con herramientas sueltas
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Hojas de cálculo, bots aislados y publicaciones sin control no escalan. Growth Factory
              une prospección, mensajería y contenido con agentes que entienden tu marca.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                'Cada proyecto aislado: marca, secretos y agentes propios.',
                'Aprobación humana en campañas y posts de Facebook.',
                'Flujos visuales para automatizar sin código.',
                'Monitor en vivo para ver qué hacen tus agentes.',
              ].map((line) => (
                <li key={line} className="flex gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <p className="text-sm font-medium text-brand-200">Ideal para</p>
            <div className="mt-4 space-y-3">
              {[
                'Agencias de marketing y software',
                'Negocios que venden por WhatsApp',
                'Equipos que prospectan en Google Maps',
                'Startups que quieren escalar sin contratar más',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Empieza a hacer crecer tu pipeline hoy
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-ink-muted">
          Crea tu cuenta, configura tu marca y activa tu primer agente en minutos.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/acceso/crear-cuenta">
            <Button size="lg" className="gap-2 px-8">
              Crear cuenta gratis
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contacto">
            <Button size="lg" variant="secondary">
              Hablar con nosotros
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
