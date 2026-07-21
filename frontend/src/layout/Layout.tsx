import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { cn } from '../lib/cn';
import { AppHeader } from './AppHeader';
import { isNavGroup, NAV_TREE, RAIL_ITEMS } from './nav-config';
import { useSetup } from '../hooks/useSetup';
import { useWhatsAppUnread } from '../hooks/useWhatsAppUnread';
import { ManageProjectsModal } from '../components/projects/ManageProjectsModal';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { status } = useSetup();
  const { unread: waUnread } = useWhatsAppUnread(true);
  const contentEnabled = Boolean(status?.contentEnabled);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    whatsapp: true,
    facebook: true,
    settings: false,
    help: false,
  });
  const [projectsOpen, setProjectsOpen] = useState(false);

  useEffect(() => {
    for (const item of NAV_TREE) {
      if (isNavGroup(item) && location.pathname.startsWith(item.base)) {
        setOpenGroups((prev) => ({ ...prev, [item.id]: true }));
      }
    }
  }, [location.pathname]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const rail = RAIL_ITEMS.filter(
    (item) => !item.featureFlag || (item.featureFlag === 'content' && contentEnabled),
  );
  const tree = NAV_TREE.filter(
    (item) => !item.featureFlag || (item.featureFlag === 'content' && contentEnabled),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <aside className="flex w-[68px] shrink-0 flex-col items-center border-r border-border-soft bg-surface-rail py-4">
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-sm font-bold text-white shadow-md shadow-brand-600/25">
          M
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto">
          {rail.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.match);
            const showWaBadge = item.match === '/whatsapp' && waUnread > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={cn(
                  'relative flex h-10 w-10 items-center justify-center rounded-2xl transition',
                  active
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-ink-muted hover:bg-surface hover:text-ink',
                )}
              >
                <Icon className="h-[18px] w-[18px] stroke-[1.75]" />
                {showWaBadge ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-0.5 text-[9px] font-bold text-white">
                    {waUnread > 9 ? '9+' : waUnread}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border-soft bg-surface-nav lg:flex">
            <div className="px-4 pb-2 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Navegación
              </p>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
              {tree.map((item) => {
                if (!isNavGroup(item)) {
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/dashboard' || item.to === '/agentes'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                          isActive
                            ? 'bg-white text-brand-600 shadow-sm'
                            : 'text-ink-muted hover:bg-white/60 hover:text-ink',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0 stroke-[1.75]" />
                      {item.label}
                    </NavLink>
                  );
                }

                const open = openGroups[item.id];
                const groupActive = location.pathname.startsWith(item.base);

                return (
                  <div key={item.id} className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                        groupActive
                          ? 'text-brand-600'
                          : 'text-ink-muted hover:bg-white/60 hover:text-ink',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0 stroke-[1.75]" />
                      <span className="flex-1">{item.label}</span>
                      {item.id === 'whatsapp' && waUnread > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                          {waUnread > 99 ? '99+' : waUnread}
                        </span>
                      ) : null}
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {open && (
                      <div className="nav-tree-line mt-0.5 space-y-0.5 py-1">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition',
                                isActive
                                  ? 'bg-white font-medium text-brand-600 shadow-sm'
                                  : 'text-ink-muted hover:bg-white/50 hover:text-ink',
                              )
                            }
                          >
                            <span>{child.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <div className="border-t border-border-soft px-4 py-3">
              <button
                type="button"
                onClick={() => setProjectsOpen(true)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-ink-muted transition hover:bg-white/60 hover:text-ink"
              >
                <FolderOpen className="h-4 w-4" />
                Gestionar proyectos
              </button>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto bg-surface">{children}</main>
        </div>
      </div>

      <ManageProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
    </div>
  );
}
