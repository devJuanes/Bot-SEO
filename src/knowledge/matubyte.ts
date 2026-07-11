import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cached: string | null = null;

export function getMatuByteKnowledge(): string {
  if (cached) return cached;
  const path = join(__dirname, '..', '..', 'docs', 'MATUBYTE.md');
  cached = readFileSync(path, 'utf-8');
  return cached;
}

export function getMatuByteSummary(): {
  company: string;
  hq: string;
  scope: string;
  products: string[];
  icp: string;
} {
  return {
    company: 'MatuByte S.A.S.',
    hq: 'Cali, Colombia',
    scope: 'Colombia + LatAm / remoto',
    products: [
      'Apps web/móvil a medida',
      'Automatizaciones y agentes IA',
      'MatuDB / Matu AI / MatuCRM / PayMatuByte',
      'SEO, growth y captación de leads',
    ],
    icp: 'Negocios sin web, con leads desordenados, o que necesitan app/CRM/automatización',
  };
}

/** Ciudades prioritarias para rotación del Cazador */
export const HUNT_LOCATIONS: Array<{
  city: string;
  country: string;
  countryCode: string;
}> = [
  { city: 'Cali', country: 'Colombia', countryCode: 'CO' },
  { city: 'Bogotá', country: 'Colombia', countryCode: 'CO' },
  { city: 'Medellín', country: 'Colombia', countryCode: 'CO' },
  { city: 'Barranquilla', country: 'Colombia', countryCode: 'CO' },
  { city: 'Cartagena', country: 'Colombia', countryCode: 'CO' },
  { city: 'Bucaramanga', country: 'Colombia', countryCode: 'CO' },
  { city: 'Pereira', country: 'Colombia', countryCode: 'CO' },
  { city: 'Manizales', country: 'Colombia', countryCode: 'CO' },
  { city: 'Ibagué', country: 'Colombia', countryCode: 'CO' },
  { city: 'Cúcuta', country: 'Colombia', countryCode: 'CO' },
  { city: 'Santa Marta', country: 'Colombia', countryCode: 'CO' },
  { city: 'Neiva', country: 'Colombia', countryCode: 'CO' },
  { city: 'Ciudad de México', country: 'México', countryCode: 'MX' },
  { city: 'Lima', country: 'Perú', countryCode: 'PE' },
  { city: 'Quito', country: 'Ecuador', countryCode: 'EC' },
  { city: 'Guayaquil', country: 'Ecuador', countryCode: 'EC' },
  { city: 'Santiago', country: 'Chile', countryCode: 'CL' },
  { city: 'Panamá', country: 'Panamá', countryCode: 'PA' },
];

/** Nichos con alta probabilidad de necesitar software / web / automatización */
export const HUNT_SECTORS: string[] = [
  'clínicas estéticas',
  'consultorios dentales',
  'veterinarias',
  'gimnasios',
  'academias de idiomas',
  'escuelas de programación',
  'barberías',
  'peluquerías',
  'spas',
  'talleres mecánicos',
  'ferreterías',
  'restaurantes',
  'cafeterías',
  'hoteles boutique',
  'hostales',
  'inmobiliarias',
  'abogados',
  'contadores',
  'agencias de viajes',
  'fisioterapia',
  'pet shops',
  'salones de uñas',
  'centros de eventos',
  'tiendas de ropa',
  'panaderías',
  'ópticas',
  'laboratorios clínicos',
  'guarderías',
  'autoescuelas',
  'estudios de arquitectura',
];
