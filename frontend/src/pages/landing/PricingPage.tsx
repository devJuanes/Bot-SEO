import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { PageMeta } from '../../components/seo/PageMeta';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { PRICING_TIERS } from './landing-data';

export function PricingPage() {
  return (
    <>
      <PageMeta
        title="Precios"
        description="Plan Pro desde $50.000 COP/mes. Código de invitación VIP para acceso sin pago. Enterprise a medida para agencias."
        path="/precios"
      />

      <section className="border-b border-border-soft bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Precios</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Plan Pro desde $50.000 COP/mes
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted">
            Paga con PSE, Nequi o tarjeta. ¿Tienes código de invitación? Crea tu cuenta VIP sin
            costo. Enterprise para agencias — habla con ventas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <article
              key={tier.name}
              className={cn(
                'flex flex-col rounded-3xl border p-6 shadow-sm',
                tier.highlighted
                  ? 'border-brand-300 bg-brand-50/30 ring-2 ring-brand-200'
                  : 'border-border-soft bg-white',
              )}
            >
              <h2 className="text-lg font-semibold text-ink">{tier.name}</h2>
              <p className="mt-2 text-3xl font-bold text-brand-600">{tier.price}</p>
              <p className="text-xs text-ink-muted">{tier.period}</p>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">{tier.description}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-ink">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {tier.cta === 'Crear cuenta' ? (
                  <Link to="/acceso/crear-cuenta" className="block">
                    <Button className="w-full" variant={tier.highlighted ? 'primary' : 'secondary'}>
                      {tier.cta}
                    </Button>
                  </Link>
                ) : (
                  <Link to="/contacto" className="block">
                    <Button className="w-full" variant={tier.highlighted ? 'primary' : 'secondary'}>
                      {tier.cta}
                    </Button>
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border-soft bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-12 text-center text-sm text-ink-muted">
          <p>
            ¿Necesitas facturación en COP, varios tenants o despliegue dedicado?{' '}
            <Link to="/contacto" className="font-medium text-brand-600 hover:underline">
              Escríbenos
            </Link>{' '}
            y armamos una propuesta según tu volumen de leads y campañas.
          </p>
        </div>
      </section>
    </>
  );
}
