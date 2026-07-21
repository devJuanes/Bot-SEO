export const LEAD_PIPELINE = [
  { key: 'new', label: 'Nuevo', color: 'border-sky-200 bg-sky-50' },
  { key: 'contacted', label: 'Contactado', color: 'border-amber-200 bg-amber-50' },
  { key: 'qualified', label: 'Calificado', color: 'border-emerald-200 bg-emerald-50' },
  { key: 'won', label: 'Ganado', color: 'border-green-300 bg-green-50' },
  { key: 'lost', label: 'Perdido', color: 'border-rose-200 bg-rose-50' },
  { key: 'discarded', label: 'Descartado', color: 'border-slate-200 bg-slate-50' },
] as const;

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  LEAD_PIPELINE.map((s) => [s.key, s.label]),
);

export const STATUS_TONES: Record<string, 'default' | 'success' | 'warning' | 'brand' | 'danger'> = {
  new: 'brand',
  contacted: 'warning',
  qualified: 'success',
  won: 'success',
  lost: 'danger',
  discarded: 'default',
};
