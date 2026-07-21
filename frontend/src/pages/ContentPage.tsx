import { useCallback, useEffect, useState } from 'react';
import { FileText, Lightbulb, Newspaper, PenLine } from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/ui/Badge';
import {
  DataTable,
  EmptyState,
  LoadingState,
  TableCell,
  TableRow,
  TableShell,
} from '../components/ui/DataTable';
import { SectionLayout } from '../layout/SectionLayout';
import { useSetup } from '../hooks/useSetup';
import { cn } from '../lib/cn';

const CONTENT_TABS = [
  { id: 'blogs', label: 'Blogs', icon: Newspaper },
  { id: 'scripts', label: 'Scripts sociales', icon: PenLine },
  { id: 'opportunities', label: 'Oportunidades', icon: Lightbulb },
  { id: 'briefs', label: 'Briefs', icon: FileText },
] as const;

type TabId = (typeof CONTENT_TABS)[number]['id'];

export function ContentPage() {
  const { status, loading: setupLoading } = useSetup();
  const [tab, setTab] = useState<TabId>('blogs');
  const [loading, setLoading] = useState(true);
  const [blogs, setBlogs] = useState<Array<Record<string, unknown>>>([]);
  const [scripts, setScripts] = useState<Array<Record<string, unknown>>>([]);
  const [opportunities, setOpportunities] = useState<Array<Record<string, unknown>>>([]);
  const [briefs, setBriefs] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contentRes, oppRes, dashRes] = await Promise.all([
        api('/api/content'),
        api('/api/opportunities'),
        api('/api/dashboard'),
      ]);
      const content = (await contentRes.json()) as {
        blogs?: Array<Record<string, unknown>>;
        scripts?: Array<Record<string, unknown>>;
      };
      const opp = (await oppRes.json()) as { opportunities?: Array<Record<string, unknown>> };
      const dash = (await dashRes.json()) as { briefs?: Array<Record<string, unknown>> };
      setBlogs(content.blogs || []);
      setScripts(content.scripts || []);
      setOpportunities(opp.opportunities || []);
      setBriefs(dash.briefs || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status?.contentEnabled) void load();
  }, [load, status?.contentEnabled]);

  if (setupLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  if (status && !status.contentEnabled) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileText}
          title="Contenido no habilitado"
          description="La sección de blogs/contenido requiere el flag content_enabled en tu proyecto. Contacta a MatuByte."
        />
      </div>
    );
  }

  // continue below with existing UI

  const rows =
    tab === 'blogs'
      ? blogs
      : tab === 'scripts'
        ? scripts
        : tab === 'opportunities'
          ? opportunities
          : briefs;

  return (
    <SectionLayout
      title="Contenido"
      description="Blogs, scripts, oportunidades y briefs generados por tus agentes de growth."
      icon={FileText}
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {CONTENT_TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
                active
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <TableShell>
          <DataTable
            columns={[
              { key: 'title', label: 'Título / Tema' },
              { key: 'status', label: 'Estado' },
              { key: 'meta', label: 'Detalle' },
              { key: 'date', label: 'Fecha' },
            ]}
          >
            {rows.length === 0 ? (
              <TableRow>
                <TableCell className="py-10 text-center text-slate-500">
                  No hay registros en esta sección todavía.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={String(row.id ?? i)}>
                  <TableCell className="max-w-md font-medium text-slate-900">
                    {String(
                      row.title ||
                        row.topic ||
                        row.name ||
                        row.keyword ||
                        row.hook ||
                        '—',
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone="brand">{String(row.status || '—')}</Badge>
                  </TableCell>
                  <TableCell className="max-w-sm truncate text-xs text-slate-500">
                    {String(
                      row.platform ||
                        row.source ||
                        row.angle ||
                        row.summary ||
                        row.description ||
                        '—',
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {row.created_at
                      ? new Date(String(row.created_at)).toLocaleDateString()
                      : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </DataTable>
        </TableShell>
      )}
    </SectionLayout>
  );
}
