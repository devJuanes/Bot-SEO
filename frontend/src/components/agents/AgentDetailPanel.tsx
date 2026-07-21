import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, History, PlayCircle, Save, Settings2, Timer } from 'lucide-react';
import { projectApi } from '../../api/client';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody } from '../ui/Card';
import { LoadingState } from '../ui/DataTable';
import { Field, Input, Textarea } from '../ui/Input';
import { StatCard } from '../ui/StatCard';
import { formatDateShort, formatDateTime, formatDuration, formatTimeShort } from '../../lib/format';
import { cn } from '../../lib/cn';

type TabId = 'metrics' | 'logs' | 'config';
type ConfigProfile = 'lead-hunter' | 'catalog' | 'custom';

interface AgentInsights {
  configProfile: ConfigProfile;
  agent?: {
    goal?: string;
    system_prompt?: string | null;
    schedule_hint?: string | null;
  };
  stats: {
    totalRuns: number;
    successRuns: number;
    errorRuns: number;
    totalDurationMs: number;
    avgDurationMs: number;
    lastRunAt: string | null;
    lastDurationMs: number | null;
  };
  activityByDay: Array<{ date: string; runs: number; success: number; errors: number }>;
  runsByStatus: Array<{ status: string; count: number }>;
  sectorHits: Array<{ sector: string; count: number }>;
  recentRuns: Array<{
    id: unknown;
    status: string;
    reason?: string;
    triggered_by?: string;
    started_at?: string;
    durationMs: number;
    details?: Record<string, unknown>;
  }>;
  logs: Array<{ ts: string; level: string; message: string }>;
  config: {
    sectors?: string[];
    useRotation?: boolean;
    instructions?: string;
  };
  brand: { brand_name: string | null; country: string };
  catalogSectors: string[];
}

const CHART_COLOR = '#e11d48';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'metrics', label: 'Métricas' },
  { id: 'logs', label: 'Logs' },
  { id: 'config', label: 'Configuración' },
];

function logTone(level: string) {
  if (level === 'error') return 'danger' as const;
  if (level === 'warn') return 'warning' as const;
  if (level === 'success') return 'success' as const;
  return 'default' as const;
}

export function AgentDetailPanel({
  agentId,
  variant = 'catalog',
}: {
  agentId: string;
  variant?: 'catalog' | 'custom';
}) {
  const [tab, setTab] = useState<TabId>('metrics');
  const [insights, setInsights] = useState<AgentInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [customSector, setCustomSector] = useState('');
  const [instructions, setInstructions] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [customScheduleHint, setCustomScheduleHint] = useState('');

  const insightsPath =
    variant === 'custom'
      ? `/custom-agents/${encodeURIComponent(agentId)}/insights`
      : `/agents/${encodeURIComponent(agentId)}/insights`;

  const load = useCallback(async () => {
    try {
      const res = await projectApi(insightsPath);
      const data = (await res.json()) as AgentInsights & { error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar métricas');
      setInsights(data);
      setSelectedSectors(data.config?.sectors ?? []);
      setInstructions(
        typeof data.config?.instructions === 'string' ? data.config.instructions : '',
      );
      setCustomGoal(data.agent?.goal ?? '');
      setCustomSystemPrompt(data.agent?.system_prompt ?? '');
      setCustomScheduleHint(data.agent?.schedule_hint ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [insightsPath]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  function toggleSector(sector: string) {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector],
    );
  }

  function addCustomSector() {
    const s = customSector.trim();
    if (!s || selectedSectors.includes(s)) return;
    setSelectedSectors((prev) => [...prev, s]);
    setCustomSector('');
  }

  async function saveConfig() {
    setSaving(true);
    setError('');
    try {
      const profile = insights?.configProfile ?? 'catalog';
      let res: Response;

      if (profile === 'custom') {
        res = await projectApi(`/custom-agents/${encodeURIComponent(agentId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            goal: customGoal,
            systemPrompt: customSystemPrompt,
            scheduleHint: customScheduleHint,
          }),
        });
      } else if (profile === 'lead-hunter') {
        res = await projectApi(`/agents/${encodeURIComponent(agentId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            config: {
              sectors: selectedSectors,
              useRotation: true,
            },
          }),
        });
      } else {
        res = await projectApi(`/agents/${encodeURIComponent(agentId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            config: {
              ...insights?.config,
              instructions: instructions.trim(),
            },
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error al guardar');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !insights) {
    return <LoadingState label="Cargando métricas del agente…" />;
  }

  const stats = insights?.stats;
  const activityData =
    insights?.activityByDay.map((d) => ({
      ...d,
      label: d.date.slice(5),
    })) ?? [];

  const breakdownChart = insights
    ? insights.configProfile === 'lead-hunter' && insights.sectorHits.length > 0
      ? {
          title: 'Sectores con más hallazgos',
          data: insights.sectorHits,
        }
      : insights.runsByStatus.length > 0
        ? {
            title: 'Resultados por estado',
            data: insights.runsByStatus.map((r) => ({
              sector: r.status,
              count: r.count,
            })),
          }
        : null
    : null;

  const configProfile = insights?.configProfile ?? 'catalog';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              tab === item.id
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                : 'bg-white text-ink-muted hover:text-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{error}</p>
      )}

      {tab === 'metrics' && insights && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Tiempo total"
              value={formatDuration(stats?.totalDurationMs)}
              icon={Clock}
            />
            <StatCard
              label="Promedio / run"
              value={formatDuration(stats?.avgDurationMs)}
              icon={Timer}
            />
            <StatCard
              label="Ejecuciones"
              value={stats?.totalRuns ?? 0}
              hint={`${stats?.successRuns ?? 0} éxitos · ${stats?.errorRuns ?? 0} errores`}
              icon={PlayCircle}
            />
            <StatCard
              label="Última ejecución"
              value={formatDateShort(stats?.lastRunAt)}
              subValue={formatTimeShort(stats?.lastRunAt)}
              hint={
                stats?.lastDurationMs
                  ? `Duró ${formatDuration(stats.lastDurationMs)}`
                  : 'Sin duración registrada'
              }
              icon={History}
              compact
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody className="p-4">
                <h3 className="text-sm font-semibold text-ink">Actividad (14 días)</h3>
                <div className="mt-3 h-48">
                  {activityData.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-ink-muted">
                      Sin ejecuciones registradas aún
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e4" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="runs"
                          name="Runs"
                          stroke={CHART_COLOR}
                          fill={CHART_COLOR}
                          fillOpacity={0.15}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-4">
                <h3 className="text-sm font-semibold text-ink">
                  {breakdownChart?.title ?? 'Desglose'}
                </h3>
                <div className="mt-3 h-48">
                  {!breakdownChart ? (
                    <p className="flex h-full items-center justify-center text-sm text-ink-muted">
                      Aún no hay datos para mostrar
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={breakdownChart.data} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e4" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="sector"
                          width={100}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip />
                        <Bar dataKey="count" name="Cantidad" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">Historial de ejecuciones</h3>
                <div className="flex gap-2 text-xs text-ink-muted">
                  <span>✓ {stats?.successRuns ?? 0}</span>
                  <span>✗ {stats?.errorRuns ?? 0}</span>
                </div>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {insights.recentRuns.length === 0 ? (
                  <p className="text-sm text-ink-muted">Sin ejecuciones todavía</p>
                ) : (
                  insights.recentRuns.map((run, i) => (
                    <div
                      key={String(run.id ?? i)}
                      className="flex items-start justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={run.status === 'error' ? 'danger' : 'success'}>
                            {run.status}
                          </Badge>
                          <span className="text-xs text-ink-muted">
                            {formatDateTime(run.started_at)}
                          </span>
                          <span className="text-xs text-ink-muted">
                            {formatDuration(run.durationMs)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-ink-muted">
                          {run.reason ||
                            (typeof run.details?.sector === 'string'
                              ? `${run.details.sector} · ${String(run.details.city ?? '')}`
                              : '—')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'logs' && insights && (
        <Card>
          <CardBody className="p-4">
            <h3 className="text-sm font-semibold text-ink">Logs en tiempo real</h3>
            <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
              {insights.logs.length === 0 ? (
                <p className="text-sm text-ink-muted">No hay logs para este agente</p>
              ) : (
                insights.logs.map((log, i) => (
                  <div
                    key={`${log.ts}-${i}`}
                    className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={logTone(log.level)}>{log.level}</Badge>
                      <span className="text-xs text-ink-muted">{formatDateTime(log.ts)}</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-ink">{log.message}</p>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'config' && insights && (
        <Card>
          <CardBody className="space-y-5 p-5">
            {configProfile === 'lead-hunter' && (
              <>
                <div className="flex items-start gap-3">
                  <Settings2 className="mt-0.5 h-5 w-5 text-brand-600" />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Sectores de búsqueda</h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      País desde tu marca: <strong>{insights.brand.country}</strong>. Elige los
                      nichos a cazar; si no seleccionas ninguno, rota por todos.
                    </p>
                    <Link
                      to="/settings/brand"
                      className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
                    >
                      Editar marca →
                    </Link>
                  </div>
                </div>

                <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                  {insights.catalogSectors.map((sector) => (
                    <label
                      key={sector}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSectors.includes(sector)}
                        onChange={() => toggleSector(sector)}
                        className="h-4 w-4 rounded border-border-soft text-brand-600"
                      />
                      <span className="text-ink">{sector}</span>
                    </label>
                  ))}
                </div>

                <Field>
                  <label className="mb-1 block text-sm font-medium">Sector personalizado</label>
                  <div className="flex gap-2">
                    <Input
                      value={customSector}
                      onChange={(e) => setCustomSector(e.target.value)}
                      placeholder="Ej. coworkings, agencias SEO…"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomSector();
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" onClick={addCustomSector}>
                      Añadir
                    </Button>
                  </div>
                </Field>

                {selectedSectors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSectors.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSector(s)}
                        className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                      >
                        {s} ×
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {configProfile === 'catalog' && (
              <>
                <div className="flex items-start gap-3">
                  <Settings2 className="mt-0.5 h-5 w-5 text-brand-600" />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Instrucciones del agente</h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      País desde tu marca: <strong>{insights.brand.country}</strong>. Añade
                      indicaciones extra para personalizar su comportamiento.
                    </p>
                    <Link
                      to="/settings/brand"
                      className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
                    >
                      Editar marca →
                    </Link>
                  </div>
                </div>

                <Field>
                  <label className="mb-1 block text-sm font-medium">Instrucciones adicionales</label>
                  <Textarea
                    rows={5}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Ej. prioriza empresas B2B en Bogotá, evita franquicias…"
                  />
                </Field>
              </>
            )}

            {configProfile === 'custom' && (
              <>
                <div className="flex items-start gap-3">
                  <Settings2 className="mt-0.5 h-5 w-5 text-brand-600" />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Configuración del agente</h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      Define el objetivo, el prompt del sistema y la frecuencia de ejecución.
                    </p>
                  </div>
                </div>

                <Field>
                  <label className="mb-1 block text-sm font-medium">Objetivo</label>
                  <Textarea
                    rows={4}
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    placeholder="Qué debe lograr este agente…"
                  />
                </Field>

                <Field>
                  <label className="mb-1 block text-sm font-medium">System prompt</label>
                  <Textarea
                    rows={4}
                    value={customSystemPrompt}
                    onChange={(e) => setCustomSystemPrompt(e.target.value)}
                    placeholder="Personalidad y reglas del agente…"
                  />
                </Field>

                <Field>
                  <label className="mb-1 block text-sm font-medium">Horario / frecuencia</label>
                  <Input
                    value={customScheduleHint}
                    onChange={(e) => setCustomScheduleHint(e.target.value)}
                    placeholder="Ej. cada mañana, semanal…"
                  />
                </Field>
              </>
            )}

            <div className="flex justify-end">
              <Button disabled={saving} onClick={() => void saveConfig()}>
                <Save className="h-4 w-4" />
                {saving ? 'Guardando…' : 'Guardar configuración'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
