/**
 * Selección de imagen de portada por tema/sector. Fotos reales de Pexels
 * (licencia libre), verificadas — mismo patrón de URL que ya usa matubyte.com.
 */
export interface CoverImage {
  url: string;
  alt: string;
}

function pexelsUrl(id: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1920`;
}

interface ImageBucket {
  match: string[];
  image: CoverImage;
}

const BUCKETS: ImageBucket[] = [
  {
    match: [
      'restaurante',
      'restaurantes',
      'cafeteria',
      'cafeterias',
      'panaderia',
      'panaderias',
      'comida',
    ],
    image: { url: pexelsUrl(30323144), alt: 'Interior de un restaurante' },
  },
  {
    match: [
      'peluqueria',
      'peluquerias',
      'barberia',
      'barberias',
      'spa',
      'salon de unas',
      'salones de unas',
      'estetica',
      'esteticas',
      'belleza',
    ],
    image: { url: pexelsUrl(7518728), alt: 'Interior de una peluquería / barbería' },
  },
  {
    match: [
      'consultorio dental',
      'consultorios dentales',
      'dental',
      'dentista',
      'odontolog',
      'laboratorio clinico',
      'laboratorios clinicos',
      'fisioterapia',
      'salud',
      'clinica',
      'clinicas',
    ],
    image: { url: pexelsUrl(3845737), alt: 'Consultorio dental / clínica de salud' },
  },
  {
    match: ['veterinaria', 'veterinarias', 'pet shop', 'pet shops', 'mascota', 'mascotas'],
    image: { url: pexelsUrl(6235121), alt: 'Veterinaria atendiendo una mascota' },
  },
  {
    match: ['gimnasio', 'gimnasios', 'fitness', 'entrenamiento'],
    image: { url: pexelsUrl(35986388), alt: 'Entrenamiento en gimnasio' },
  },
  {
    match: [
      'academia',
      'academias',
      'idiomas',
      'escuela de programacion',
      'guarderia',
      'guarderias',
      'autoescuela',
      'autoescuelas',
      'educacion',
      'colegio',
    ],
    image: { url: pexelsUrl(37829289), alt: 'Estudiantes en un aula' },
  },
  {
    match: ['hotel', 'hoteles', 'hostal', 'hostales', 'agencia de viajes', 'centro de eventos', 'eventos'],
    image: { url: pexelsUrl(7512139), alt: 'Recepción de un hotel' },
  },
  {
    match: ['inmobiliaria', 'inmobiliarias', 'arquitectura', 'construccion'],
    image: { url: pexelsUrl(38243293), alt: 'Fachada de una vivienda' },
  },
  {
    match: ['abogado', 'abogados', 'contador', 'contadores', 'legal', 'juridic'],
    image: { url: pexelsUrl(8112162), alt: 'Reunión en oficina legal' },
  },
  {
    match: ['taller mecanico', 'talleres mecanicos', 'ferreteria', 'ferreterias', 'mecanico'],
    image: { url: pexelsUrl(7019371), alt: 'Taller mecánico automotriz' },
  },
  {
    match: ['tienda de ropa', 'tiendas de ropa', 'retail', 'ecommerce', 'e-commerce', 'optica', 'opticas'],
    image: { url: pexelsUrl(15306470), alt: 'Interior de una tienda de ropa' },
  },
  {
    match: ['logistica', 'bodega', 'almacen', 'transporte de carga'],
    image: { url: pexelsUrl(31856778), alt: 'Bodega y logística' },
  },
  {
    match: ['facturacion', 'dian', 'factura electronica'],
    image: { url: pexelsUrl(7567444), alt: 'Facturación electrónica' },
  },
  {
    match: ['erp', 'punto de venta', 'pos', 'inventario'],
    image: { url: pexelsUrl(3184292), alt: 'Panel ERP en computador' },
  },
  {
    match: ['automatizacion', 'bot', 'agente', 'ia', 'inteligencia artificial'],
    image: { url: pexelsUrl(3861969), alt: 'Automatización de procesos' },
  },
  {
    match: ['base de datos', 'database', 'matudb'],
    image: { url: pexelsUrl(1181675), alt: 'Base de datos en la nube' },
  },
  {
    match: ['saas', 'suscripcion'],
    image: { url: pexelsUrl(1181677), alt: 'Producto SaaS' },
  },
];

const FALLBACK_ROTATION: CoverImage[] = [
  { url: pexelsUrl(1092644), alt: 'Desarrollo web y software a medida' },
  { url: pexelsUrl(4050291), alt: 'Programación y desarrollo de software' },
  { url: pexelsUrl(3184360), alt: 'Equipo trabajando en software' },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickCoverImage(input: {
  sector?: string | null;
  keywords?: string[] | null;
  title?: string;
}): CoverImage {
  const haystack = normalize(
    [input.sector ?? '', ...(input.keywords ?? []), input.title ?? ''].join(' '),
  );

  let best: { image: CoverImage; score: number } | null = null;
  for (const bucket of BUCKETS) {
    const score = bucket.match.reduce(
      (acc, term) => (haystack.includes(term) ? acc + 1 : acc),
      0,
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { image: bucket.image, score };
    }
  }

  if (best) return best.image;

  const index = hashString(input.title ?? input.sector ?? 'matubyte') % FALLBACK_ROTATION.length;
  return FALLBACK_ROTATION[index]!;
}
