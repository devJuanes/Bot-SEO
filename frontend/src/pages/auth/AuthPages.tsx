import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { parseJsonResponse } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import { Field, Input } from '../../components/ui/Input';

type AuthMode = 'login' | 'register';

function AuthShell({
  mode,
  children,
}: {
  mode: AuthMode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-surface">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-ink p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 20% 20%, rgba(225,29,72,0.35), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(225,29,72,0.2), transparent 50%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-sm font-bold shadow-lg shadow-brand-600/40">
              M
            </div>
            <div>
              <div className="text-lg font-bold">MatuByte</div>
              <div className="text-xs text-white/60">Growth Factory</div>
            </div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            {mode === 'login'
              ? 'Bienvenido de nuevo al cockpit de growth.'
              : 'Crea tu cuenta y configura tu marca en minutos.'}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Agentes de leads, WhatsApp y Facebook en un SaaS multi-proyecto. Datos reales, control
            humano, sin relleno.
          </p>
        </div>
        <p className="relative text-xs text-white/40">© MatuByte S.A.S. · Cali, Colombia</p>
      </aside>

      <main className="flex flex-1 flex-col justify-center overflow-hidden px-6 py-8 sm:px-12">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { isAuthenticated, loading, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextDefault = mode === 'register' ? '/setup' : '/dashboard';
  const next = params.get('next') || nextDefault;
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) navigate(next, { replace: true });
  }, [isAuthenticated, loading, next, navigate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const body =
      mode === 'login'
        ? { email, password }
        : {
            email,
            password,
            name: String(form.get('name') || '').trim() || email,
            organizationName: String(form.get('org') || '').trim() || undefined,
          };

    try {
      let res: Response;
      try {
        res = await fetch(
          mode === 'login' ? '/api/auth/login' : '/api/auth/register',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
          },
        );
      } catch {
        throw new Error('No se pudo conectar con el servidor. Ejecuta npm run dev.');
      }
      const data = await parseJsonResponse<{
        error?: string;
        token?: string;
        project?: { id: string };
        projects?: Array<{ id: string }>;
        organization?: { id: string };
        organizations?: Array<{ id: string }>;
      }>(res);
      if (!res.ok) throw new Error(data.error || 'Error de autenticación');
      const projectId =
        data.project?.id ||
        (data.projects && data.projects[0] && data.projects[0].id) ||
        null;
      const orgId =
        data.organization?.id ||
        (data.organizations && data.organizations[0] && data.organizations[0].id) ||
        null;
      if (!data.token) throw new Error('El servidor no devolvió token de sesión');
      login(data.token, projectId, orgId);
      navigate(mode === 'register' ? '/setup' : next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <PageLoader subtitle="Verificando tu sesión…" />;
  }

  return (
    <AuthShell mode={mode}>
      <div className="mb-6 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            M
          </div>
          <span className="font-bold">Growth Factory</span>
        </div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-ink">
        {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {mode === 'login' ? (
          <>
            ¿No tienes cuenta?{' '}
            <Link to="/acceso/crear-cuenta" className="font-medium text-brand-600 hover:underline">
              Regístrate
            </Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{' '}
            <Link to="/acceso/iniciar-sesion" className="font-medium text-brand-600 hover:underline">
              Inicia sesión
            </Link>
          </>
        )}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
        {mode === 'register' && (
          <Field>
            <label className="mb-1 block text-sm font-medium text-ink">Nombre</label>
            <Input name="name" autoComplete="name" required />
          </Field>
        )}
        <Field>
          <label className="mb-1 block text-sm font-medium text-ink">Email</label>
          <Input name="email" type="email" required autoComplete="username" />
        </Field>
        <Field>
          <label className="mb-1 block text-sm font-medium text-ink">Contraseña</label>
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </Field>
        {mode === 'register' && (
          <Field>
            <label className="mb-1 block text-sm font-medium text-ink">Organización</label>
            <Input name="org" placeholder="Mi empresa" />
          </Field>
        )}
        {error && (
          <p className="rounded-2xl bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</p>
        )}
        <Button type="submit" className="w-full" loading={submitting}>
          {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link to="/" className="font-medium text-brand-600 hover:underline">
          Volver al inicio
        </Link>
      </p>
    </AuthShell>
  );
}

export function LoginPage() {
  return <AuthPage mode="login" />;
}

export function RegisterPage() {
  return <AuthPage mode="register" />;
}
