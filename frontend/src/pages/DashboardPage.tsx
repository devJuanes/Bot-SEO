import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bot,
  FileText,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { LoadingState } from '../components/ui/DataTable';
import { StatCard } from '../components/ui/StatCard';
import { usePolling } from '../hooks/usePolling';
import { LEAD_PIPELINE } from '../lib/leads-pipeline';

interface Agent {
  id: string;
  name: string;
  role: string;
  is_enabled?: boolean;
  autopilot_enabled?: boolean;
}

interface DashboardData {
  project?: { name: string };
  stats?: Record<string, number>;
  agents?: Agent[];
  logs?: Array<{ ts: string; level: string; agentId?: string; message: string }>;
}

interface LeadStats {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  needsWebsite: number;
}

const CHART_COLORS = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (_silent = false) => {
    try {
      const [dashRes, statsRes] = await Promise.all([
        api('/api/dashboard'),
        api('/api/leads/stats'),
      ]);
      setData((await dashRes.json()) as DashboardData);
      setLeadStats((await statsRes.json()) as LeadStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(() => void refresh(true), 30_000, true, false);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <LoadingState label="Cargando reporte…" />
      </div>
    );
  }

  const stats = data?.stats ?? {};
  const agents = data?.agents ?? [];
  const sourceChart = leadStats
    ? Object.entries(leadStats.bySource)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))
    : [];
  const pipelineRows = LEAD_PIPELINE.map((stage) => ({
    key: stage.key,
    label: stage.label,
    count: leadStats?.byStatus[stage.key] ?? 0,
  })).filter((row) => row.count > 0);
  const activityData = (data?.logs ?? []).slice(0, 14).map((log, i) => ({
    idx: i + 1,
    level: log.level === 'error' ? 3 : log.level === 'warn' ? 2 : 1,
  }));

  const totalLeads = leadStats?.total ?? stats.leadsApprox ?? 0;
  const hasPipeline = pipelineRows.length > 0;
  const hasActivity = (data?.logs ?? []).length > 0;

  return (
    <div className="p-5 lg:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {agents.length === 0 ? (
            <span className="text-sm text-ink-muted">No hay agentes</span>
          ) : (
            agents.slice(0, 5).map((a, i) => (
              <div
                key={a.id}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-surface-nav text-xs font-bold text-ink-muted shadow-sm"
                style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i }}
                title={a.name}
              >
                {a.name.charAt(0)}
              </div>
            ))
          )}
          {agents.length > 5 && (
            <span className="ml-1 text-xs font-medium text-ink-muted">+{agents.length - 5}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/agentes">
            <Button size="sm" variant="secondary">
              Ver agentes
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium text-ink-muted">Resumen de growth</p>
        <div className="mt-1 flex flex-wrap items-end gap-4">
          <div>
            <p className="text-sm text-ink-muted">Leads totales</p>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight text-ink lg:text-5xl">
                {totalLeads.toLocaleString()}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-6 flex flex-wrap gap-3">
        <StatCard label="Sin sitio web" value={leadStats?.needsWebsite ?? stats.needsWebsite ?? 0} icon={Target} />
        <StatCard label="Oportunidades" value={stats.opportunities ?? 0} icon={TrendingUp} dark />
        <StatCard label="Contenido" value={(stats.blogs ?? 0) + (stats.scripts ?? 0)} icon={FileText} />
        <StatCard label="Agentes activos" value={agents.filter((a) => a.is_enabled).length} icon={Bot} />
        <StatCard label="Contactos WA" value={stats.whatsappConversations ?? 0} icon={Users} />
      </div>

      {/* Charts grid */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <h2 className="font-semibold text-ink">Leads por fuente</h2>
              <p className="text-xs text-ink-muted">
                {sourceChart.length} fuente{sourceChart.length === 1 ? '' : 's'} · {totalLeads}{' '}
                leads en total
              </p>
            </div>
          </CardHeader>
          <CardBody className="h-72 pt-0">
            {sourceChart.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-ink-muted">No hay datos</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceChart} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b6b6f' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b6b6f' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid #e8e8e4',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                    }}
                  />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} maxBarSize={48}>
                    {sourceChart.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-semibold text-ink">Pipeline</h2>
              <p className="text-xs text-ink-muted">Estado de leads</p>
            </div>
            <Link to="/leads">
              <Button size="sm" variant="dark">
                Detalles
              </Button>
            </Link>
          </CardHeader>
          <CardBody className="space-y-3 pt-0">
            {!hasPipeline ? (
              <p className="text-sm text-ink-muted">No hay datos</p>
            ) : (
              pipelineRows.map((row, i) => (
                <div key={row.key} className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-nav">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (row.count / Math.max(totalLeads, 1)) * 100)}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                  <span className="w-24 text-right text-xs font-medium text-ink-muted">
                    {row.label}
                  </span>
                  <span className="w-8 text-right text-sm font-semibold text-ink">{row.count}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-ink">Agentes del proyecto</h2>
            <Link to="/agentes">
              <Button size="sm" variant="secondary">
                Gestionar
              </Button>
            </Link>
          </CardHeader>
          <CardBody className="space-y-2 pt-0">
            {agents.length === 0 ? (
              <p className="text-sm text-ink-muted">No hay agentes</p>
            ) : (
              agents.slice(0, 6).map((agent) => (
                <Link
                  key={agent.id}
                  to={`/agents/${agent.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 transition hover:bg-surface-nav"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-600 shadow-sm">
                      {agent.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{agent.name}</div>
                      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                        {agent.role}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-nowrap gap-1.5">
                    {agent.is_enabled && <Badge tone="brand">En ejecución</Badge>}
                    {!agent.is_enabled && <Badge>Pausado</Badge>}
                  </div>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-semibold text-ink">Dinámica de actividad</h2>
              <p className="text-xs text-ink-muted">Logs del sistema</p>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            {!hasActivity ? (
              <p className="py-10 text-sm text-ink-muted">No hay datos</p>
            ) : (
              <>
                <div className="mb-4 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData}>
                      <defs>
                        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e11d48" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="level"
                        stroke="#e11d48"
                        strokeWidth={2}
                        fill="url(#actGrad)"
                        dot={{ r: 3, fill: '#e11d48', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {(data?.logs ?? []).slice(0, 5).map((log, i) => (
                    <div key={i} className="rounded-xl bg-surface px-3 py-2 text-xs text-ink-muted">
                      <span className="font-semibold text-ink">{log.agentId || 'sys'}</span>
                      {' · '}
                      {log.message}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
