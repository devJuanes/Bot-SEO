/**
 * Selección de imagen de portada por tema/sector. Fotos reales de Pexels
 * (licencia libre). Varias por bucket + rotación por hash para no repetir siempre.
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
  images: CoverImage[];
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
    images: [
      { url: pexelsUrl(262978), alt: 'Restaurante moderno' },
      { url: pexelsUrl(941861), alt: 'Cocina profesional' },
      { url: pexelsUrl(958545), alt: 'Comensales en restaurante' },
    ],
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
    images: [
      { url: pexelsUrl(3993449), alt: 'Peluquería profesional' },
      { url: pexelsUrl(1813272), alt: 'Barbería' },
      { url: pexelsUrl(3738344), alt: 'Salón de belleza' },
    ],
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
    images: [
      { url: pexelsUrl(3845737), alt: 'Consultorio de salud' },
      { url: pexelsUrl(4386466), alt: 'Atención médica' },
      { url: pexelsUrl(3376799), alt: 'Clínica moderna' },
    ],
  },
  {
    match: ['veterinaria', 'veterinarias', 'pet shop', 'pet shops', 'mascota', 'mascotas'],
    images: [{ url: pexelsUrl(6235121), alt: 'Veterinaria' }],
  },
  {
    match: ['gimnasio', 'gimnasios', 'fitness', 'entrenamiento'],
    images: [
      { url: pexelsUrl(1954524), alt: 'Gimnasio' },
      { url: pexelsUrl(841130), alt: 'Entrenamiento' },
    ],
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
    images: [
      { url: pexelsUrl(5212345), alt: 'Aula y formación' },
      { url: pexelsUrl(4145153), alt: 'Estudiantes con laptop' },
    ],
  },
  {
    match: ['hotel', 'hoteles', 'hostal', 'hostales', 'agencia de viajes', 'centro de eventos', 'eventos'],
    images: [{ url: pexelsUrl(258154), alt: 'Hotel / hospitalidad' }],
  },
  {
    match: ['inmobiliaria', 'inmobiliarias', 'arquitectura', 'construccion'],
    images: [
      { url: pexelsUrl(1396122), alt: 'Arquitectura moderna' },
      { url: pexelsUrl(323780), alt: 'Edificio en construcción' },
    ],
  },
  {
    match: ['abogado', 'abogados', 'contador', 'contadores', 'legal', 'juridic'],
    images: [{ url: pexelsUrl(8112162), alt: 'Oficina legal' }],
  },
  {
    match: ['taller mecanico', 'talleres mecanicos', 'ferreteria', 'ferreterias', 'mecanico'],
    images: [{ url: pexelsUrl(3806288), alt: 'Taller mecánico' }],
  },
  {
    match: ['tienda de ropa', 'tiendas de ropa', 'retail', 'ecommerce', 'e-commerce', 'optica', 'opticas'],
    images: [
      { url: pexelsUrl(1884581), alt: 'Retail / tienda' },
      { url: pexelsUrl(230544), alt: 'Comercio electrónico' },
    ],
  },
  {
    match: ['logistica', 'bodega', 'almacen', 'transporte de carga'],
    images: [{ url: pexelsUrl(2199293), alt: 'Logística' }],
  },
  {
    match: ['facturacion', 'dian', 'factura electronica'],
    images: [{ url: pexelsUrl(7567444), alt: 'Facturación electrónica' }],
  },
  {
    match: ['erp', 'punto de venta', 'pos', 'inventario'],
    images: [{ url: pexelsUrl(3184292), alt: 'ERP / POS' }],
  },
  {
    match: [
      'crm',
      'clientes',
      'leads',
      'pipeline',
      'ventas',
      'seguimiento',
      'matucrm',
    ],
    images: [
      { url: pexelsUrl(3184465), alt: 'Equipo de ventas y CRM' },
      { url: pexelsUrl(3183150), alt: 'Dashboard de clientes' },
      { url: pexelsUrl(7688336), alt: 'Gestión de contactos' },
    ],
  },
  {
    match: [
      'whatsapp',
      'mensajeria',
      'chatbot',
      'bot',
      'atencion al cliente',
      'inbox',
    ],
    images: [
      { url: pexelsUrl(5053740), alt: 'Chat y mensajería móvil' },
      { url: pexelsUrl(5053739), alt: 'WhatsApp business en celular' },
      { url: pexelsUrl(607812), alt: 'Comunicación digital' },
    ],
  },
  {
    match: [
      'transformacion digital',
      'digitalizacion',
      'digitalizar',
      'pyme',
      'pymes',
      'pyme ',
      'negocio local',
      'emprendimiento',
    ],
    images: [
      { url: pexelsUrl(3184291), alt: 'PYME digitalizando procesos' },
      { url: pexelsUrl(3184339), alt: 'Negocio con tecnología' },
      { url: pexelsUrl(3184418), alt: 'Equipo emprendedor con laptops' },
      { url: pexelsUrl(3183197), alt: 'Oficina moderna digital' },
    ],
  },
  {
    match: [
      'automatizacion',
      'agente',
      'inteligencia artificial',
      ' ia ',
      'ia,',
      'machine learning',
    ],
    images: [
      { url: pexelsUrl(8386440), alt: 'Inteligencia artificial' },
      { url: pexelsUrl(6153354), alt: 'Automatización con IA' },
      { url: pexelsUrl(3861969), alt: 'Procesos automatizados' },
    ],
  },
  {
    match: [
      'software',
      'desarrollo',
      'programacion',
      'codigo',
      'app',
      'aplicacion',
      'web',
      'sitio web',
      'pagina web',
      'landing',
      'saas',
      'matubyte',
    ],
    images: [
      { url: pexelsUrl(1181675), alt: 'Código y desarrollo' },
      { url: pexelsUrl(546819), alt: 'Programación en laptop' },
      { url: pexelsUrl(574071), alt: 'Desarrollador escribiendo código' },
      { url: pexelsUrl(1181467), alt: 'Pantalla con software' },
      { url: pexelsUrl(270348), alt: 'Editor de código' },
    ],
  },
  {
    match: ['seo', 'google', 'marketing', 'redes sociales', 'contenido'],
    images: [
      { url: pexelsUrl(265087), alt: 'Analytics y marketing' },
      { url: pexelsUrl(905163), alt: 'SEO y métricas' },
      { url: pexelsUrl(6476589), alt: 'Contenido en redes' },
    ],
  },
  {
    match: ['base de datos', 'database', 'matudb', 'nube', 'cloud'],
    images: [{ url: pexelsUrl(325229), alt: 'Servidores y nube' }],
  },
];

const FALLBACK_ROTATION: CoverImage[] = [
  { url: pexelsUrl(1092644), alt: 'Desarrollo web y software a medida' },
  { url: pexelsUrl(4050291), alt: 'Programación y desarrollo de software' },
  { url: pexelsUrl(3184360), alt: 'Equipo trabajando en software' },
  { url: pexelsUrl(3184291), alt: 'Negocio digital' },
  { url: pexelsUrl(3184339), alt: 'Tecnología para empresas' },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickFromImages(images: CoverImage[], seed: string): CoverImage {
  if (images.length === 1) return images[0]!;
  return images[hashString(seed) % images.length]!;
}

export function pickCoverImage(input: {
  sector?: string | null;
  keywords?: string[] | null;
  title?: string;
}): CoverImage {
  const seed = input.title ?? input.sector ?? 'matubyte';
  const haystack = normalize(
    [input.sector ?? '', ...(input.keywords ?? []), input.title ?? ''].join(' '),
  );

  let best: { images: CoverImage[]; score: number } | null = null;
  for (const bucket of BUCKETS) {
    const score = bucket.match.reduce((acc, term) => {
      const t = normalize(term);
      if (!t) return acc;
      // Términos cortos (ia) solo cuenta con límites de palabra aproximados
      if (t.length <= 3) {
        return new RegExp(`(?:^|[^a-z0-9])${t}(?:$|[^a-z0-9])`).test(haystack)
          ? acc + 2
          : acc;
      }
      return haystack.includes(t) ? acc + (t.length > 8 ? 2 : 1) : acc;
    }, 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { images: bucket.images, score };
    }
  }

  if (best) return pickFromImages(best.images, seed);

  return pickFromImages(FALLBACK_ROTATION, seed);
}

/**
 * Selector pensado para posts de Facebook: usa title + body + keywords + temas LLM.
 */
export function pickFacebookImage(input: {
  topic?: string;
  hook?: string;
  message?: string;
  hashtags?: string[];
  imageThemes?: string[];
  trendTitle?: string;
}): CoverImage {
  const keywords = [
    ...(input.hashtags ?? []).map((h) => h.replace(/^#/, '')),
    ...(input.imageThemes ?? []),
  ];
  return pickCoverImage({
    sector: input.topic ?? null,
    keywords,
    title: [input.topic, input.hook, input.trendTitle, input.message?.slice(0, 280)]
      .filter(Boolean)
      .join(' '),
  });
}
