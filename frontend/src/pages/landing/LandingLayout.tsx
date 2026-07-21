import { Link, NavLink, Outlet } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { LANDING_NAV } from './landing-data';

export function LandingLayout() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-30 border-b border-border-soft/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-600/30">
              M
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">MatuByte</div>
              <div className="text-[11px] text-ink-muted">Growth Factory</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-ink-muted md:flex">
            {LANDING_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn('transition hover:text-ink', isActive && 'text-brand-600')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/acceso/iniciar-sesion"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-ink-muted transition hover:text-ink sm:inline"
            >
              Iniciar sesión
            </Link>
            <Link to="/acceso/crear-cuenta">
              <Button size="sm">Crear cuenta</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-border-soft bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white">
                M
              </div>
              <span className="text-lg font-semibold">MatuByte S.A.S.</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
              Software a medida, automatización e inteligencia artificial para empresas que quieren
              crecer en Latinoamérica.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Producto</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
              {LANDING_NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="transition hover:text-brand-600">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Empresa</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
              <li>
                <a
                  href="https://matubyte.com"
                  className="transition hover:text-brand-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  matubyte.com
                </a>
              </li>
              <li>Cali, Colombia</li>
            </ul>
            <h2 className="mt-6 text-sm font-semibold text-ink">Redes</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
              <li>
                <a
                  href="https://www.facebook.com/matubyte"
                  className="transition hover:text-brand-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/matubyte"
                  className="transition hover:text-brand-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/matubyte"
                  className="transition hover:text-brand-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border-soft py-5 text-center text-xs text-ink-muted">
          © {new Date().getFullYear()} MatuByte S.A.S. · Growth Factory
        </div>
      </footer>
    </div>
  );
}
