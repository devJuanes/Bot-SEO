/**
 * Catálogo editorial veraz de MatuByte.
 * FymApp es aliado recomendado (ERP / facturación electrónica DIAN), no producto propio.
 */

export type CatalogOwnership = 'matubyte' | 'partner' | 'service';

export type AudiencePillar =
  | 'education'
  | 'general'
  | 'entrepreneurs'
  | 'developers'
  | 'trends'
  | 'use_cases'
  | 'commercial';

export interface CatalogEntry {
  id: string;
  slug: string;
  name: string;
  ownership: CatalogOwnership;
  tagline: string;
  description: string;
  url?: string;
  features: string[];
  audiences: AudiencePillar[];
  /** Aviso obligatorio cuando ownership === 'partner' */
  partnerNote?: string;
  ctaHint?: string;
}

export const AUDIENCE_PILLARS: AudiencePillar[] = [
  'education',
  'general',
  'entrepreneurs',
  'developers',
  'trends',
  'use_cases',
  'commercial',
];

/** Peso editorial: mayoría educativa; commercial es minoritario. */
export const PILLAR_WEIGHTS: Record<AudiencePillar, number> = {
  education: 4,
  general: 2,
  entrepreneurs: 2,
  developers: 2,
  trends: 2,
  use_cases: 2,
  commercial: 1,
};

export const PRODUCT_CATALOG: CatalogEntry[] = [
  {
    id: 'matucourse',
    slug: 'matucourse',
    name: 'MatuCourse',
    ownership: 'matubyte',
    tagline: 'LMS para crear, vender y certificar cursos en línea',
    description:
      'Plataforma de aprendizaje con módulos, videoconferencias, exámenes, certificados automáticos, gamificación y panel de instructor.',
    url: 'https://matucourse.matubyte.com',
    features: [
      'Módulos y lecciones con video',
      'Exámenes y certificados automáticos',
      'Videoconferencias en vivo',
      'Gamificación y analíticas de progreso',
    ],
    audiences: ['education', 'entrepreneurs', 'use_cases', 'commercial'],
    ctaHint: 'Demo en matucourse.matubyte.com',
  },
  {
    id: 'parking',
    slug: 'parking',
    name: 'MatuPark / Parking',
    ownership: 'matubyte',
    tagline: 'Control integral de parqueaderos en tiempo real',
    description:
      'Sistema de gestión de parqueaderos (MatuPark) con entradas/salidas, tarifas, reportes de ingresos y panel operativo en tiempo real.',
    url: 'https://matubyte.com/software/parking',
    features: [
      'Control de entradas y salidas',
      'Tarifas por hora, día o turno',
      'Reportes de ingresos',
      'Alertas de capacidad',
    ],
    audiences: ['entrepreneurs', 'use_cases', 'commercial', 'education'],
    ctaHint: 'Ver Parking en matubyte.com/software/parking',
  },
  {
    id: 'cmr',
    slug: 'cmr',
    name: 'CMR',
    ownership: 'matubyte',
    tagline: 'CRM para ventas en Colombia y Latinoamérica',
    description:
      'CRM en la nube (crm.matubyte.com): prospectos, pipeline Kanban, cotizaciones/facturas, formularios web y analíticas de embudo.',
    url: 'https://crm.matubyte.com/',
    features: [
      'Pipeline visual Kanban',
      'Cotizaciones y facturas con branding',
      'Formularios captadores de leads',
      'Multi-usuario con permisos',
    ],
    audiences: ['entrepreneurs', 'use_cases', 'commercial', 'education'],
    ctaHint: 'Probar en crm.matubyte.com',
  },
  {
    id: 'matusendmail',
    slug: 'matusendmail',
    name: 'MatuSendMail',
    ownership: 'matubyte',
    tagline: 'Correos transaccionales y masivos',
    description:
      'Servicio de email (Matu Mailer) con plantillas HTML, analíticas de entrega/apertura/clic y API REST para integrar en cualquier app.',
    url: 'https://mail.matucatalogo.com',
    features: [
      'API REST transaccional y masiva',
      'Plantillas HTML con variables',
      'Open/click rate y rebotes',
      'Webhooks de entrega',
    ],
    audiences: ['developers', 'entrepreneurs', 'use_cases', 'education'],
    ctaHint: 'mail.matucatalogo.com',
  },
  {
    id: 'matupdf',
    slug: 'matupdf',
    name: 'MatuPDF',
    ownership: 'matubyte',
    tagline: 'Motor de PDFs con plantillas dinámicas',
    description:
      'Genera facturas, contratos, reportes y certificados en PDF desde plantillas HTML vía API REST.',
    url: 'https://matupdf.matubyte.com',
    features: [
      'Plantillas HTML dinámicas',
      'Facturas, contratos y certificados',
      'API REST (base64 o stream)',
      'Encabezado, pie y marca de agua',
    ],
    audiences: ['developers', 'use_cases', 'education', 'entrepreneurs'],
    ctaHint: 'matupdf.matubyte.com',
  },
  {
    id: 'ebook-app',
    slug: 'ebook-app',
    name: 'EBook App',
    ownership: 'matubyte',
    tagline: 'Libros digitales y cursos con lectura offline',
    description:
      'Plataforma para publicar y consumir libros, guías y cursos con lectura offline, progreso sincronizado y panel de autores.',
    url: 'https://matubyte.com/software/ebook-app',
    features: [
      'Lectura offline',
      'Progreso y notas del lector',
      'Panel de publicación',
      'EPUB y PDF',
    ],
    audiences: ['education', 'general', 'entrepreneurs', 'use_cases'],
    ctaHint: 'matubyte.com/software/ebook-app',
  },
  {
    id: 'matucash',
    slug: 'matucash',
    name: 'MatuCash',
    ownership: 'matubyte',
    tagline: 'Flujo de caja, ingresos y egresos en tiempo real',
    description:
      'App de control financiero con ingresos/egresos categorizados, saldo actual, dashboard y reportes exportables.',
    url: 'https://matubyte.com/software/matucash',
    features: [
      'Ingresos y egresos categorizados',
      'Saldo en tiempo real',
      'Dashboard financiero',
      'Exportación PDF/Excel',
    ],
    audiences: ['entrepreneurs', 'education', 'use_cases', 'commercial'],
    ctaHint: 'matubyte.com/software/matucash',
  },
  {
    id: 'matupicks',
    slug: 'matupicks',
    name: 'MatuPicks',
    ownership: 'matubyte',
    tagline: 'Pronósticos deportivos y picks con análisis',
    description:
      'Plataforma de picks gratuitos y VIP, noticias, estadísticas y panel de seguimiento de resultados.',
    url: 'https://matubyte.com/software/matupicks',
    features: [
      'Picks gratuitos y VIP',
      'Calendario y noticias',
      'Historial de resultados',
      'Suscripción VIP',
    ],
    audiences: ['general', 'trends', 'use_cases', 'commercial'],
    ctaHint: 'matubyte.com/software/matupicks',
  },
  {
    id: 'matudb',
    slug: 'matudb',
    name: 'MatuDB',
    ownership: 'matubyte',
    tagline: 'PostgreSQL BaaS self-hosted con API tipo Supabase',
    description:
      'Plataforma de datos (matudb.com): PostgreSQL, auth JWT, storage, tiempo real y cliente TypeScript @devjuanes/matuclient.',
    url: 'https://matudb.com/',
    features: [
      'PostgreSQL + API familiar',
      'Auth JWT y storage',
      'Tiempo real (WebSockets)',
      'Cliente TypeScript oficial',
    ],
    audiences: ['developers', 'education', 'entrepreneurs', 'trends'],
    ctaHint: 'matudb.com',
  },
  {
    id: 'custom-dev',
    slug: 'custom-dev',
    name: 'Desarrollo a medida',
    ownership: 'service',
    tagline: 'Apps web/móvil, APIs, automatizaciones y bots',
    description:
      'Servicio de ingeniería de MatuByte S.A.S. (Cali): aplicaciones web y móviles, backends, automatizaciones, bots e integraciones locales (PSE, Nequi, WhatsApp, RFID).',
    url: 'https://matubyte.com',
    features: [
      'Apps web y móviles',
      'APIs y backends',
      'Automatizaciones y agentes IA',
      'Integraciones CO (pagos, WhatsApp, IoT)',
    ],
    audiences: ['entrepreneurs', 'developers', 'use_cases', 'commercial', 'education'],
    ctaHint: 'Contacto / WhatsApp en matubyte.com',
  },
  {
    id: 'fymapp',
    slug: 'fymapp',
    name: 'FymApp',
    ownership: 'partner',
    tagline: 'ERP en la nube con facturación electrónica DIAN',
    description:
      'Aliado recomendado por MatuByte para ERP operativo y facturación electrónica DIAN (POS, inventario, kardex, reportes). No es un producto de MatuByte.',
    url: 'https://fymappsoftware.com',
    features: [
      'Facturación electrónica DIAN',
      'POS e inventario multi-bodega',
      'Kardex y reportes gerenciales',
      'ERP en la nube',
    ],
    audiences: ['entrepreneurs', 'education', 'use_cases', 'commercial'],
    partnerNote:
      'FymApp es producto de FymApp Software (fymappsoftware.com). MatuByte lo recomienda como aliado para ERP/facturación DIAN; no lo presentes como software propio de MatuByte.',
    ctaHint: 'Recomendar fymappsoftware.com (aliado, no producto MatuByte)',
  },
];

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return PRODUCT_CATALOG.find((p) => p.slug === slug || p.id === slug);
}

export function listOwnedProducts(): CatalogEntry[] {
  return PRODUCT_CATALOG.filter((p) => p.ownership !== 'partner');
}

export function formatCatalogForPrompt(entries: CatalogEntry[] = PRODUCT_CATALOG): string {
  return entries
    .map((p) => {
      const ownership =
        p.ownership === 'partner'
          ? 'ALIADO (no es producto MatuByte)'
          : p.ownership === 'service'
            ? 'SERVICIO MatuByte'
            : 'PRODUCTO MatuByte';
      const note = p.partnerNote ? `\n  Nota: ${p.partnerNote}` : '';
      return `- ${p.name} [${ownership}] (${p.slug})\n  ${p.tagline}\n  ${p.description}\n  URL: ${p.url ?? 'n/a'}\n  Features: ${p.features.join('; ')}${note}`;
    })
    .join('\n');
}

export function catalogSummaryLines(): string[] {
  return PRODUCT_CATALOG.map((p) => {
    if (p.ownership === 'partner') {
      return `${p.name} (aliado DIAN/ERP — no es de MatuByte)`;
    }
    if (p.ownership === 'service') return `${p.name} (servicio)`;
    return p.name;
  });
}
