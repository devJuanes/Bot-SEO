import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Search,
  TrendingUp,
  Star,
  Users,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { LoadingState } from '../components/ui/DataTable';
import { SectionLayout } from '../layout/SectionLayout';
import { formatDateTime } from '../lib/format';
import { cn } from '../lib/cn';
import { LeadWhatsAppChat } from '../components/leads/LeadWhatsAppChat';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  city: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
  source: string;
  status: string;
  business_type: string | null;
  needs_website: boolean;
  google_rating: number | null;
  google_reviews_count?: number | null;
  google_maps_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at?: string;
  raw_data?: Record<string, unknown>;
}

const SOURCE_LABELS: Record<string, string> = {
  google_maps: 'Google Maps',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Calificado',
  won: 'Ganado',
  lost: 'Perdido',
};

const COUNTRY_LABELS: Record<string, string> = {
  CO: 'Colombia',
  MX: 'México',
  AR: 'Argentina',
  CL: 'Chile',
  PE: 'Perú',
  EC: 'Ecuador',
  ES: 'España',
  US: 'Estados Unidos',
};

const RAW_FIELD_LABELS: Record<string, string> = {
  query: 'Búsqueda realizada',
  scraped_at: 'Detectado el',
  opportunity: 'Oportunidad detectada',
  country_name: 'País de la búsqueda',
};

const OPPORTUNITY_LABELS: Record<string, string> = {
  website_or_app: 'Necesita sitio web o aplicación',
  no_website: 'Sin presencia web',
  low_rating: 'Rating bajo en Google',
  few_reviews: 'Pocas reseñas',
};

function labelForSource(source: string) {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, ' ');
}

function labelForStatus(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function countryLabel(lead: Lead) {
  const fromRaw = lead.raw_data?.country_name;
  if (typeof fromRaw === 'string' && fromRaw.trim()) return fromRaw.trim();
  if (lead.country && COUNTRY_LABELS[lead.country]) return COUNTRY_LABELS[lead.country];
  return lead.country || 'Sin país';
}

function phoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  return `tel:${digits}`;
}

function websiteHref(url: string) {
  return url.startsWith('http') ? url : `https://${url}`;
}

function formatWebsiteLabel(url: string) {
  try {
    return new URL(websiteHref(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function humanizeRawValue(key: string, value: unknown): string {
  if (value == null || value === '') return 'Sin dato';
  if (key === 'scraped_at' && typeof value === 'string') return formatDateTime(value);
  if (key === 'opportunity' && typeof value === 'string') {
    return OPPORTUNITY_LABELS[value] ?? value.replace(/_/g, ' ');
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return 'Sin dato';
}

function humanizeRawLabel(key: string) {
  if (RAW_FIELD_LABELS[key]) return RAW_FIELD_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildMapEmbedUrl(lead: Lead): string | null {
  if (lead.latitude != null && lead.longitude != null) {
    return `https://maps.google.com/maps?q=${lead.latitude},${lead.longitude}&z=16&output=embed`;
  }
  if (lead.address?.trim()) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(lead.address.trim())}&z=16&output=embed`;
  }
  if (lead.google_maps_url) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(lead.google_maps_url)}&output=embed`;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function StarRating({
  rating,
  reviewCount,
}: {
  rating: number | string;
  reviewCount?: number | string | null;
}) {
  const score = toNumber(rating) ?? 0;
  const reviews = toNumber(reviewCount);
  const stars = Array.from({ length: 5 }, (_, index) => {
    const starValue = index + 1;
    const filled = score >= starValue;
    const half = !filled && score >= starValue - 0.5;
    return { filled, half };
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-0.5">
        {stars.map((star, index) => (
          <Star
            key={index}
            className={cn(
              'h-5 w-5',
              star.filled
                ? 'fill-amber-400 text-amber-400'
                : star.half
                  ? 'fill-amber-200 text-amber-400'
                  : 'text-slate-200',
            )}
          />
        ))}
      </div>
      <span className="text-2xl font-bold tracking-tight text-ink">{score.toFixed(1)}</span>
      {reviews != null ? (
        <span className="text-sm text-ink-muted">
          {reviews} {reviews === 1 ? 'reseña' : 'reseñas'}
        </span>
      ) : null}
    </div>
  );
}

function ContactAction({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const hasValue = Boolean(value && value !== 'Sin registrar');

  const inner = (
    <>
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
          hasValue ? 'bg-brand-50 text-brand-600' : 'bg-surface text-ink-muted',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p
          className={cn(
            'mt-0.5 truncate text-sm font-semibold',
            hasValue ? 'text-ink' : 'italic text-ink-muted',
          )}
        >
          {value}
        </p>
      </div>
      {hasValue && external ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-ink-muted" />
      ) : null}
    </>
  );

  const className = cn(
    'flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition',
    hasValue
      ? 'border-border-soft bg-white hover:border-brand-200 hover:bg-brand-50/40'
      : 'border-dashed border-border-soft bg-surface',
  );

  if (hasValue && href) {
    return (
      <a
        href={href}
        className={className}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
      >
        {inner}
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}

function DetectionInsight({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border-soft bg-surface px-3.5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium leading-relaxed text-ink">
          {value}
        </p>
      </div>
    </div>
  );
}

export function LeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await api(`/api/leads/${encodeURIComponent(id)}`);
        const data = await res.text();
        if (!res.ok) {
          let msg = 'No encontrado';
          try {
            const parsed = JSON.parse(data) as { error?: string };
            if (parsed.error) msg = parsed.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        const json = JSON.parse(data) as { lead: Lead };
        setLead(json.lead);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const detectionEntries = lead?.raw_data
    ? Object.entries(lead.raw_data).map(([key, value]) => ({
        key,
        label: humanizeRawLabel(key),
        value: humanizeRawValue(key, value),
      }))
    : [];

  const mapUrl = lead ? buildMapEmbedUrl(lead) : null;

  return (
    <SectionLayout
      title="Detalle del lead"
      description="Información completa del prospecto."
      icon={Users}
      actions={
        <Link to="/leads">
          <Button size="sm" variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </Link>
      }
    >
      {loading ? (
        <LoadingState />
      ) : error || !lead ? (
        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {error || 'Lead no encontrado'}
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card className="min-w-0 overflow-hidden">
              <CardBody className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="info">{labelForSource(lead.source)}</Badge>
                    <Badge>{labelForStatus(lead.status)}</Badge>
                    {lead.needs_website ? <Badge tone="warning">Necesita web</Badge> : null}
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight text-ink break-words">
                      {lead.name}
                    </h2>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                      <span>{lead.business_type || 'Sin sector'}</span>
                      <span className="text-border-soft">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {lead.city || 'Sin ciudad'}, {countryLabel(lead)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <ContactAction
                    icon={Phone}
                    label="Teléfono"
                    value={lead.phone || 'Sin registrar'}
                    href={lead.phone ? phoneHref(lead.phone) : undefined}
                  />
                  <ContactAction
                    icon={Mail}
                    label="Correo"
                    value={lead.email || 'Sin registrar'}
                    href={lead.email ? `mailto:${lead.email}` : undefined}
                  />
                  <ContactAction
                    icon={Globe}
                    label="Sitio web"
                    value={lead.website ? formatWebsiteLabel(lead.website) : 'Sin registrar'}
                    href={lead.website ? websiteHref(lead.website) : undefined}
                    external
                  />
                </div>
              </CardBody>
            </Card>

            <Card className="min-w-0 overflow-hidden">
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">Ubicación</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted">
                      {lead.address || 'No hay dirección registrada para este lead.'}
                    </p>
                  </div>
                  {lead.google_maps_url ? (
                    <a
                      href={lead.google_maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                    >
                      Abrir en Google Maps
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>

                {mapUrl ? (
                  <div className="overflow-hidden rounded-2xl border border-border-soft bg-surface">
                    <iframe
                      title={`Mapa de ${lead.name}`}
                      src={mapUrl}
                      className="h-64 w-full border-0 sm:h-72"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border-soft bg-surface text-sm text-ink-muted">
                    No hay coordenadas para mostrar el mapa
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="min-w-0">
              <CardBody className="space-y-5">
                <div>
                  <h3 className="font-semibold text-ink">Reputación en Google</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Valoración pública del negocio en Maps.
                  </p>
                </div>

                {toNumber(lead.google_rating) != null ? (
                  <StarRating
                    rating={lead.google_rating!}
                    reviewCount={lead.google_reviews_count}
                  />
                ) : (
                  <p className="rounded-2xl bg-surface px-4 py-5 text-center text-sm text-ink-muted">
                    Sin valoración en Google
                  </p>
                )}

                <div className="space-y-3 border-t border-border-soft pt-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-muted">Necesita web</span>
                    <Badge tone={lead.needs_website ? 'warning' : 'default'}>
                      {lead.needs_website ? 'Sí' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-muted">País</span>
                    <span className="font-medium text-ink">{countryLabel(lead)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-muted">Detectado</span>
                    <span className="font-medium text-ink">{formatDateTime(lead.created_at)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="min-w-0">
              <CardBody className="space-y-4">
                <div>
                  <h3 className="font-semibold text-ink">Detección automática</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Cómo encontramos este prospecto y qué oportunidad vimos.
                  </p>
                </div>

                {detectionEntries.length === 0 ? (
                  <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-muted">
                    No hay datos adicionales de detección.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {detectionEntries.map((entry) => (
                      <DetectionInsight
                        key={entry.key}
                        label={entry.label}
                        value={entry.value}
                        icon={
                          entry.key === 'query'
                            ? Search
                            : entry.key === 'scraped_at'
                              ? Calendar
                              : entry.key === 'opportunity'
                                ? TrendingUp
                                : Globe
                        }
                      />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {lead && !loading && !error ? (
        <LeadWhatsAppChat
          lead={{ id: lead.id, name: lead.name, phone: lead.phone, status: lead.status }}
          onStatusChange={(status) => setLead((prev) => (prev ? { ...prev, status } : prev))}
        />
      ) : null}
    </SectionLayout>
  );
}
