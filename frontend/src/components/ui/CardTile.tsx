import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { Card, CardBody } from './Card';

/** Encabezado consistente: badges arriba, título y subtítulo con buen ritmo vertical. */
export function CardEntityHeader({
  title,
  subtitle,
  badges,
  titleClassName,
  subtitleClassName,
  as: Tag = 'h3',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  titleClassName?: string;
  subtitleClassName?: string;
  as?: 'h2' | 'h3' | 'div';
}) {
  return (
    <div className="space-y-3">
      {badges ? (
        <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
      ) : null}
      <div className="min-w-0">
        <Tag
          className={cn(
            'text-[15px] font-semibold leading-snug tracking-tight text-ink',
            titleClassName,
          )}
        >
          {title}
        </Tag>
        {subtitle ? (
          <p
            className={cn(
              'mt-2 text-sm leading-relaxed text-ink-muted',
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Card de entidad para grids: alturas parejas, texto legible, acciones abajo. */
export function CardTile({
  title,
  titleHref,
  eyebrow,
  description,
  badges,
  footer,
  className,
}: {
  title: string;
  titleHref?: string;
  eyebrow?: string;
  description?: string;
  badges?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const titleEl = titleHref ? (
    <Link
      to={titleHref}
      className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-ink transition hover:text-brand-600"
    >
      {title}
    </Link>
  ) : (
    <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-ink">
      {title}
    </h3>
  );

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardBody className="flex flex-1 flex-col p-5">
        {badges ? (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">{badges}</div>
        ) : null}

        <div className="min-w-0">
          {titleEl}
          {eyebrow ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {eyebrow}
            </p>
          ) : null}
        </div>

        {description ? (
          <p className="mt-4 min-h-[4.25rem] flex-1 text-sm leading-relaxed text-ink-muted line-clamp-3">
            {description}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        {footer ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border-soft pt-4">
            {footer}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Fila seleccionable en modales / listas con título + descripción apilados. */
export function CardListItem({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border-soft bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug text-ink">{title}</p>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted line-clamp-2">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
