import { Link } from 'react-router-dom';
import {
  Bot,
  MessageCircle,
  Share2,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

const FEATURES = [
  {
    icon: Target,
    title: 'Caza de leads real',
    body: 'Agentes que prospectan negocios y oportunidades según tu marca y sector — no dashboards vacíos.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp operativo',
    body: 'Inbox, campañas con plantillas Meta y seguimiento de contactos en un solo lugar.',
  },
  {
    icon: Share2,
    title: 'Facebook con aprobación',
    body: 'Genera posts con IA, revisa la cola y publica cuando tú digas. Brief personalizado incluido.',
  },
  {
    icon: Bot,
    title: 'Agentes a tu medida',
    body: 'Activa cazadores, scouts y agentes custom con objetivos propios para tu empresa o app.',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-20 border-b border-border-soft/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-sm font-bold text-white shadow-md shadow-brand-600/25">
              M
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">MatuByte</div>
              <div className="text-[11px] text-ink-muted">Growth Factory</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/acceso/iniciar-sesion"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink sm:inline"
            >
              Iniciar sesión
            </Link>
            <Link to="/acceso/crear-cuenta">
              <Button size="sm">Crear cuenta</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border-soft">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 70% 10%, rgba(225,29,72,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(225,29,72,0.06), transparent 50%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <Sparkles className="h-3.5 w-3.5" />
              SaaS multi-proyecto
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              MatuByte{' '}
              <span className="text-brand-600">Growth Factory</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
              Orquesta agentes de prospección, WhatsApp y redes sociales para hacer crecer tu
              empresa o tu producto — con datos reales, marca propia y control humano.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/acceso/crear-cuenta">
                <Button className="px-6">Empezar ahora</Button>
              </Link>
              <Link to="/acceso/iniciar-sesion">
                <Button variant="secondary">Ya tengo cuenta</Button>
              </Link>
            </div>
          </div>
          <div className="soft-card relative overflow-hidden p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Zap className="h-4 w-4 text-brand-600" />
              Qué resolvemos
            </div>
            <ul className="space-y-3 text-sm text-ink-muted">
              <li className="rounded-2xl bg-surface px-4 py-3">
                Dejas de depender de hojas de cálculo y bots sueltos.
              </li>
              <li className="rounded-2xl bg-surface px-4 py-3">
                Cada proyecto tiene su marca, secretos y agentes — aislados.
              </li>
              <li className="rounded-2xl bg-surface px-4 py-3">
                Apruebas campañas y posts antes de publicar. Cero sorpresas.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-bold tracking-tight">Funcionalidades</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Todo lo que ves en el producto está conectado a APIs y a tu base de datos. Sin números
          inventados.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="soft-card p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border-soft bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white">
                M
              </div>
              <span className="font-semibold">MatuByte S.A.S.</span>
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              Software a medida, automatización y growth para empresas en LatAm.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Empresa</h4>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <li>
                <a href="https://matubyte.com" className="hover:text-brand-600" target="_blank" rel="noreferrer">
                  matubyte.com
                </a>
              </li>
              <li>Cali, Colombia</li>
              <li>CEO: Juan Luis Maturana</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Redes</h4>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <li>
                <a
                  href="https://www.facebook.com/matubyte"
                  className="hover:text-brand-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/matubyte"
                  className="hover:text-brand-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/matubyte"
                  className="hover:text-brand-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border-soft py-4 text-center text-xs text-ink-muted">
          © {new Date().getFullYear()} MatuByte S.A.S. · Growth Factory
        </div>
      </footer>
    </div>
  );
}
