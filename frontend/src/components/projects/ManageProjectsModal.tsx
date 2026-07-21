import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Plus, Settings } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiJson } from '../../api/client';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ProjectListRow } from './ProjectListRow';

export function ManageProjectsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { allProjects, projectId, organizations, setActiveProject, refreshMe } = useAuth();
  const [newName, setNewName] = useState('');
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { orgId: string; orgName: string; projects: Array<{ id: string; name: string; type: string }> }
    >();
    for (const { org, project } of allProjects) {
      const entry = map.get(org.id) ?? {
        orgId: org.id,
        orgName: org.name,
        projects: [],
      };
      entry.projects.push(project);
      map.set(org.id, entry);
    }
    return [...map.values()];
  }, [allProjects]);

  const effectiveOrgId = orgId || organizations[0]?.id || '';

  function selectProject(id: string, oid: string) {
    setActiveProject(id, oid);
    onClose();
  }

  async function createProject() {
    const name = newName.trim();
    if (!name || !effectiveOrgId) return;
    setCreating(true);
    setError('');
    try {
      const data = await apiJson<{ project: { id: string } }>(
        `/api/organizations/${encodeURIComponent(effectiveOrgId)}/projects`,
        {
          method: 'POST',
          body: JSON.stringify({ name, type: 'company', brandName: name }),
        },
      );
      await refreshMe();
      setNewName('');
      if (data.project?.id) {
        selectProject(data.project.id, effectiveOrgId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el proyecto');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Gestionar proyectos" size="lg">
      <div className="space-y-6">
        <p className="text-sm text-ink-muted">
          Cada proyecto tiene sus propios leads, agentes, WhatsApp y ajustes. Cambia el activo o crea
          uno nuevo para otra marca o cliente.
        </p>

        <div className="space-y-4">
          {grouped.length === 0 ? (
            <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-muted">
              No hay proyectos en tu cuenta.
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.orgId}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {group.orgName}
                </p>
                <ul className="space-y-1.5">
                  {group.projects.map((project) => (
                      <li key={project.id}>
                        <ProjectListRow
                          projectId={project.id}
                          name={project.name}
                          type={project.type}
                          active={project.id === projectId}
                          onSelect={() => selectProject(project.id, group.orgId)}
                        />
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-dashed border-border-soft bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-ink">Nuevo proyecto</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {organizations.length > 1 ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">Organización</label>
                <Select value={effectiveOrgId} onChange={(e) => setOrgId(e.target.value)}>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className={organizations.length > 1 ? '' : 'sm:col-span-2'}>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Nombre del proyecto
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Cliente ABC"
              />
            </div>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-brand-700">{error}</p>
          ) : null}
          <Button
            size="sm"
            className="mt-3"
            loading={creating}
            disabled={!newName.trim() || !effectiveOrgId}
            onClick={() => void createProject()}
          >
            <FolderOpen className="h-4 w-4" />
            Crear proyecto
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft pt-4">
          <Link
            to="/settings/project"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
          >
            <Settings className="h-4 w-4" />
            Ajustes del proyecto activo
          </Link>
        </div>
      </div>
    </Modal>
  );
}
