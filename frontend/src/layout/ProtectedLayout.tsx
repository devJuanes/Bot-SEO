import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Layout } from './Layout';
import { useSetup } from '../hooks/useSetup';
import { LoadingState } from '../components/ui/DataTable';
import { PageLoader } from '../components/ui/PageLoader';

function BrandGate({ children }: { children: React.ReactNode }) {
  const { status, loading } = useSetup();
  const location = useLocation();
  const onSetup = location.pathname.startsWith('/setup');

  if (loading && !status) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState label="Cargando proyecto…" compact />
      </div>
    );
  }

  if (status && !status.brandConfigured && !onSetup) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

export function ProtectedLayout() {
  const { isAuthenticated, loading, projectId } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader subtitle="Verificando tu sesión…" />;
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/acceso/iniciar-sesion?next=${next}`} replace />;
  }

  return (
    <Layout>
      <BrandGate>
        <Outlet key={projectId ?? 'default'} />
      </BrandGate>
    </Layout>
  );
}
