import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { parseJsonResponse } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';

type Status = 'loading' | 'success' | 'pending' | 'error';

export function PaymentResultPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Verificando tu pago…');

  const reference = params.get('reference') || '';
  const paidParam = params.get('paid') === 'true';
  const statusParam = params.get('status') || '';

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      setMessage('No se encontró la referencia de pago.');
      return;
    }

    let cancelled = false;

    async function complete() {
      try {
        if (!paidParam && statusParam && !['PAID', 'APPROVED', 'SALE_APPROVED'].includes(statusParam)) {
          setStatus('error');
          setMessage('El pago no fue aprobado. Intenta de nuevo o contacta soporte.');
          return;
        }

        const res = await fetch('/api/billing/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reference }),
        });

        const data = await parseJsonResponse<{
          error?: string;
          paid?: boolean;
          token?: string;
          project?: { id: string };
          organization?: { id: string };
          alreadyCompleted?: boolean;
        }>(res);

        if (res.status === 402) {
          setStatus('pending');
          setMessage('Estamos esperando la confirmación del pago. Esto puede tardar unos segundos…');
          setTimeout(() => {
            if (!cancelled) void complete();
          }, 3000);
          return;
        }

        if (!res.ok) {
          throw new Error(data.error || 'No se pudo completar el registro');
        }

        if (data.token) {
          login(data.token, data.project?.id ?? null, data.organization?.id ?? null);
        }

        setStatus('success');
        setMessage(
          data.alreadyCompleted
            ? 'Tu cuenta ya estaba activa. Redirigiendo…'
            : '¡Pago confirmado! Tu cuenta Pro está lista.',
        );

        setTimeout(() => {
          if (!cancelled) navigate('/setup', { replace: true });
        }, 2000);
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, [reference, paidParam, statusParam, login, navigate]);

  if (!reference) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6">
        <div className="max-w-md text-center">
          <XCircle className="mx-auto h-12 w-12 text-brand-600" />
          <h1 className="mt-4 text-xl font-bold">Referencia no válida</h1>
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
          <Link to="/acceso/crear-cuenta" className="mt-6 inline-block">
            <Button>Volver al registro</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'loading' || status === 'pending') {
    return <PageLoader subtitle={message} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-md text-center">
        {status === 'success' ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        ) : (
          <XCircle className="mx-auto h-12 w-12 text-brand-600" />
        )}
        <h1 className="mt-4 text-xl font-bold">
          {status === 'success' ? '¡Cuenta activada!' : 'No se pudo completar'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">{message}</p>
        {status === 'success' ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirigiendo al setup…
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/acceso/crear-cuenta">
              <Button className="w-full">Intentar de nuevo</Button>
            </Link>
            <Link to="/contacto">
              <Button variant="secondary" className="w-full">
                Contactar soporte
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
