import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiJson } from '../../api/client';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { ProjectListRow } from './ProjectListRow';
import { cn } from '../../lib/cn';

export function ProjectSwitcherDropdown() {
  const { allProjects, projectId, organizations, me, setActiveProject, refreshMe } = useAuth();
  const active = allProjects.find((x) => x.project.id === projectId);
  const companyName =
    active?.org.name ?? organizations[0]?.name ?? me?.user.name ?? 'MatuByte';
  const companyInitial = companyName.trim().charAt(0).toUpperCase() || 'M';
  const activeProjectName = active?.project.name;

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? '');
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { orgId: string; orgName: string; projects: Array<{ id: string; name: string; type: string }> }
    >();
    for (const { org, project } of allProjects) {
      const entry = map.get(org.id) ?? { orgId: org.id, orgName: org.name, projects: [] };
      entry.projects.push(project);
      map.set(org.id, entry);
    }
    return [...map.values()];
  }, [allProjects]);

  const effectiveOrgId = orgId || organizations[0]?.id || '';

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function selectProject(id: string, oid: string) {
    setActiveProject(id, oid);
    setOpen(false);
    setShowCreate(false);
    setError('');
  }

  async function handleCreate() {
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
      setShowCreate(false);
      if (data.project?.id) selectProject(data.project.id, effectiveOrgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el proyecto');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-full py-1.5 pl-1 pr-3 text-sm font-semibold text-ink transition hover:bg-surface',
          open && 'bg-surface',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {companyInitial}
        </span>
        <span className="hidden max-w-[140px] truncate sm:block">
          <span className="block truncate leading-tight">{companyName}</span>
          {activeProjectName && activeProjectName !== companyName ? (
            <span className="block truncate text-[10px] font-normal text-ink-muted">
              {activeProjectName}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-ink-muted transition', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-soft bg-white shadow-xl">
          <div className="border-b border-border-soft px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Proyectos
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-ink">{companyName}</p>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {grouped.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-ink-muted">Sin proyectos</p>
            ) : (
              grouped.map((group) => (
                <div key={group.orgId} className="mb-2 last:mb-0">
                  {grouped.length > 1 ? (
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase text-ink-muted">
                      {group.orgName}
                    </p>
                  ) : null}
                  <ul>
                    {group.projects.map((project) => (
                        <li key={project.id}>
                          <ProjectListRow
                            projectId={project.id}
                            name={project.name}
                            active={project.id === projectId}
                            compact
                            onSelect={() => selectProject(project.id, group.orgId)}
                          />
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border-soft p-2">
            {!showCreate ? (
              <button
                type="button"
                onClick={() => {
                  setShowCreate(true);
                  setError('');
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-brand-300 bg-brand-50">
                  <Plus className="h-4 w-4" />
                </span>
                Crear proyecto
              </button>
            ) : (
              <div className="space-y-2 rounded-xl bg-surface p-3">
                {organizations.length > 1 ? (
                  <Select
                    value={effectiveOrgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    className="h-9 text-xs"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre del proyecto"
                  className="h-9 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreate();
                    if (e.key === 'Escape') setShowCreate(false);
                  }}
                />
                {error ? <p className="text-xs text-brand-700">{error}</p> : null}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    loading={creating}
                    disabled={!newName.trim()}
                    onClick={() => void handleCreate()}
                  >
                    Crear
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setShowCreate(false);
                      setNewName('');
                      setError('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
