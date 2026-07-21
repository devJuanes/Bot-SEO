import { NavLink } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';
import { FilterButton } from '../components/ui/Button';

export interface TabItem {
  to: string;
  label: string;
  end?: boolean;
}

export function TabNav({ tabs, className }: { tabs: TabItem[]; className?: string }) {
  return (
    <nav className={cn('flex flex-wrap gap-2', className)}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              isActive
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                : 'bg-white text-ink-muted hover:text-ink',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function SectionLayout({
  title,
  description,
  tabs,
  actions,
  showFilter = true,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tabs?: TabItem[];
  actions?: React.ReactNode;
  showFilter?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col p-5 lg:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {showFilter ? (
            <FilterButton>
              Filtro <ChevronDown className="h-3.5 w-3.5" />
            </FilterButton>
          ) : null}
        </div>
      </div>
      {tabs && tabs.length > 0 && <div className="mb-6"><TabNav tabs={tabs} /></div>}
      <div className="flex-1">{children}</div>
    </div>
  );
}
