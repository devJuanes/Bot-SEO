import { Link } from 'react-router-dom';
import type { SetupStatus } from '../../hooks/useSetup';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export interface AgentConfigTarget {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

interface BrandProfile {
  brand_name?: string;
  country?: string;
}

function brandSummary(setup: SetupStatus | null) {
  const profile = (setup?.brandProfile ?? {}) as BrandProfile;
  const name =
    profile.brand_name?.trim() ||
    setup?.project?.brand_name?.trim() ||
    'Tu marca';
  const country = profile.country?.trim() || 'Colombia';
  return { name, country };
}

export function AgentConfigModal({
  agent,
  setup,
  open,
  busy,
  onClose,
}: {
  agent: AgentConfigTarget | null;
  setup: SetupStatus | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
}) {
  if (!agent) return null;

  const brand = brandSummary(setup);

  return (
    <Modal open={open} onClose={onClose} title={`${agent.name}`}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-border-soft bg-surface px-4 py-4 text-sm">
          <p className="font-medium text-ink">Configuración en la ficha del agente</p>
          <p className="mt-2 leading-relaxed text-ink-muted">
            País desde <strong className="text-ink">{brand.name}</strong> ({brand.country}).
            {agent.id === 'lead-hunter'
              ? ' Los sectores de búsqueda se configuran en la pestaña Configuración dentro del agente.'
              : ' Este agente trabaja automáticamente mientras no esté pausado.'}
          </p>
          <Link
            to={`/agents/${agent.id}`}
            onClick={onClose}
            className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Abrir ficha del agente →
          </Link>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose} disabled={busy}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
