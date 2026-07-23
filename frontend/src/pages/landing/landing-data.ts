import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Bot,
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Settings,
  Share2,
  Target,
  Users,
  Workflow,
} from 'lucide-react';

export const LANDING_NAV = [
  { to: '/funciones', label: 'Funciones' },
  { to: '/como-funciona', label: 'Cómo funciona' },
  { to: '/precios', label: 'Precios' },
  { to: '/soporte', label: 'Soporte' },
  { to: '/contacto', label: 'Contacto' },
] as const;

export const MARQUEE_ITEMS = [
  'Lead Hunter',
  'WhatsApp Inbox',
  'Facebook con aprobación',
  'Flujos visuales',
  'Monitor en vivo',
  'Pipeline Kanban',
  'Agentes custom',
  'Multi-proyecto',
];

export const STATS = [
  { value: 'Multi-proyecto', label: 'Una cuenta, varios negocios aislados por tenant' },
  { value: 'Tiempo real', label: 'WhatsApp, monitor de agentes y notificaciones' },
  { value: 'LatAm', label: 'Hecho para vender por WhatsApp y redes' },
];

export const HOME_FEATURES = [
  {
    title: 'Prospección real',
    body: 'Agentes buscan negocios en Google Maps según tu sector y ciudad.',
  },
  {
    title: 'WhatsApp operativo',
    body: 'Inbox en vivo, modo humano/bot y campañas con plantillas Meta.',
  },
  {
    title: 'Facebook con control',
    body: 'La IA propone; tú apruebas. Nada se publica sin tu OK.',
  },
  {
    title: 'Automatiza sin código',
    body: 'Flujos visuales que conectan leads, agentes y mensajes.',
  },
];

export interface FeatureModule {
  icon: LucideIcon;
  title: string;
  body: string;
  tag: string;
  bullets: string[];
}

export const FEATURE_MODULES: FeatureModule[] = [
  {
    icon: Target,
    title: 'Lead Hunter y prospección',
    body: 'Agentes que buscan negocios en Google Maps y fuentes reales según tu sector, ciudad y brief de marca.',
    tag: 'Lead Hunter',
    bullets: [
      'Scraping de Google Maps con datos de contacto y rating',
      'Opportunity Scout para detectar oportunidades de negocio',
      'Puntuación, etiquetas y estados en tu pipeline',
    ],
  },
  {
    icon: Users,
    title: 'Pipeline Kanban de leads',
    body: 'Tablero visual para mover prospectos entre etapas, priorizar oportunidades y no perder ningún contacto.',
    tag: 'Leads',
    bullets: [
      'Vista Kanban y detalle por lead con historial',
      'Chat WhatsApp integrado por prospecto',
      'Notas, detección de oportunidad y datos de origen',
    ],
  },
  {
    icon: Workflow,
    title: 'Flujos y automatizaciones',
    body: 'Editor visual de flujos para disparar acciones cuando entra un lead, cambia de estado o un agente termina.',
    tag: 'Flujos',
    bullets: [
      'Canvas tipo n8n con nodos y condiciones',
      'Triggers por eventos de leads y agentes',
      'Motor de automatización integrado en la plataforma',
    ],
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp operativo',
    body: 'Inbox en tiempo real con modo humano/bot, campañas con plantillas Meta y seguimiento por contacto.',
    tag: 'WhatsApp',
    bullets: [
      'Bandeja de mensajes y conversaciones por lead',
      'Campañas masivas y plantillas aprobadas',
      'Webhook de Meta y gestión de contactos',
    ],
  },
  {
    icon: Share2,
    title: 'Facebook con control humano',
    body: 'Genera posts con IA según tu brief de marca, revisa la cola y publica solo cuando apruebas.',
    tag: 'Facebook',
    bullets: [
      'Generación de contenido con LLM configurable',
      'Cola de aprobación antes de publicar',
      'Historial de publicados y webhook de Meta',
    ],
  },
  {
    icon: Bot,
    title: 'Agentes de IA especializados',
    body: 'Catálogo de agentes listos y posibilidad de crear agentes custom por proyecto.',
    tag: 'Agentes',
    bullets: [
      'Lead Hunter, Social Creator, Blog Writer, Facebook Publisher y más',
      'Chat por agente y agentes personalizados',
      'Configuración de credenciales y brief por proyecto',
    ],
  },
  {
    icon: Monitor,
    title: 'Monitor en vivo',
    body: 'Espacio de trabajo visual donde ves tus agentes trabajando en tiempo real — sin dashboards vacíos.',
    tag: 'Monitor',
    bullets: [
      'Estado de ejecución por agente',
      'Socket en tiempo real para actividad',
      'Ideal para operaciones y soporte interno',
    ],
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard y métricas',
    body: 'Resumen de actividad, leads, interacciones y salud del proyecto en un solo cockpit.',
    tag: 'Dashboard',
    bullets: [
      'KPIs de prospección y contenido',
      'Accesos rápidos a módulos activos',
      'Vista por proyecto multi-tenant',
    ],
  },
  {
    icon: Bot,
    title: 'Chat de empresa',
    body: 'Conversa con un asistente que conoce tu marca, catálogo y contexto del proyecto.',
    tag: 'Company Chat',
    bullets: [
      'Respuestas con conocimiento de tu negocio',
      'Útil para brainstorming y soporte interno',
      'Integrado con configuración de marca y LLM',
    ],
  },
  {
    icon: Settings,
    title: 'Ajustes multi-tenant',
    body: 'Cada proyecto aislado con su marca, secretos, WhatsApp, Facebook y proveedor de LLM.',
    tag: 'Settings',
    bullets: [
      'Organizaciones, proyectos y usuarios',
      'Marca, tono, sector y brief editorial',
      'Credenciales cifradas por proyecto',
    ],
  },
  {
    icon: Bell,
    title: 'Notificaciones',
    body: 'Alertas en la app cuando hay mensajes, tickets o eventos importantes en tu proyecto.',
    tag: 'Notificaciones',
    bullets: [
      'Centro de notificaciones en el cockpit',
      'Push admin vía WebSocket',
      'Seguimiento de tickets de soporte interno',
    ],
  },
];

export const STEPS = [
  {
    n: '01',
    title: 'Crea tu cuenta y proyecto',
    body: 'Regístrate, define tu organización y crea el primer proyecto. Cada proyecto es un tenant aislado con sus propios datos.',
  },
  {
    n: '02',
    title: 'Configura marca e integraciones',
    body: 'Completa el setup: sector, tono, WhatsApp (webhook Meta), Facebook Page, proveedor LLM y brief de contenido.',
  },
  {
    n: '03',
    title: 'Activa agentes y flujos',
    body: 'Enciende Lead Hunter, scouts de contenido o agentes custom. Conecta flujos para automatizar sin código.',
  },
  {
    n: '04',
    title: 'Opera y escala',
    body: 'Gestiona leads en Kanban, responde por WhatsApp, aprueba posts de Facebook y monitorea todo en vivo.',
  },
];

export const PRICING_TIERS = [
  {
    name: 'Pro',
    price: '$50.000',
    period: 'COP / mes',
    description:
      'Acceso completo a agentes de leads, WhatsApp, Facebook, flujos y automatizaciones para un proyecto.',
    features: [
      'Lead Hunter y pipeline Kanban',
      'WhatsApp inbox, campañas y plantillas',
      'Facebook con cola de aprobación',
      'Agentes de contenido y blog',
      'Flujos y monitor en vivo',
      'Pago seguro con PSE, Nequi o tarjeta',
    ],
    cta: 'Crear cuenta',
    highlighted: true,
  },
  {
    name: 'VIP',
    price: 'Invitación',
    period: 'código requerido',
    description:
      'Acceso completo sin pago si tienes un código de invitación de MatuByte o un partner.',
    features: [
      'Todo lo del plan Pro',
      'Activación inmediata sin tarjeta',
      'Ideal para beta testers y aliados',
      'Soporte prioritario de onboarding',
    ],
    cta: 'Crear cuenta',
    highlighted: false,
  },
  {
    name: 'Enterprise',
    price: 'A medida',
    period: 'contacto comercial',
    description:
      'Para agencias y empresas que gestionan múltiples marcas con aislamiento total por tenant.',
    features: [
      'Multi-proyecto ilimitado',
      'Onboarding asistido',
      'Integraciones y webhooks dedicados',
      'SLA y soporte técnico',
    ],
    cta: 'Hablar con ventas',
    highlighted: false,
  },
];

export const FAQ_ITEMS = [
  {
    q: '¿Cuánto cuesta Growth Factory?',
    a: 'El plan Pro cuesta $50.000 COP al mes e incluye agentes de leads, WhatsApp, Facebook y automatizaciones. Si tienes un código de invitación VIP, creas tu cuenta sin pagar.',
  },
  {
    q: '¿Cómo funciona el código de invitación?',
    a: 'Al registrarte, ingresa tu código en el campo opcional. Si es válido, tu cuenta se activa con acceso VIP completo sin pasar por el pago.',
  },
  {
    q: '¿Cómo conecto WhatsApp Business?',
    a: 'En Ajustes → WhatsApp configuras el token de Meta, el número y el webhook. Growth Factory recibe mensajes en tiempo real y los muestra en la bandeja de mensajes.',
  },
  {
    q: '¿Los agentes publican en Facebook sin mi permiso?',
    a: 'No por defecto. Los posts generados van a una cola de aprobación; tú decides cuándo publicar en tu página.',
  },
  {
    q: '¿Puedo tener varios negocios en una cuenta?',
    a: 'Sí. Una organización puede tener múltiples proyectos, cada uno con marca, credenciales y datos aislados.',
  },
  {
    q: '¿Qué proveedores de IA soportan?',
    a: 'Puedes configurar el proveedor LLM por proyecto en Ajustes → LLM (OpenAI-compatible y otros según tu configuración).',
  },
  {
    q: '¿Dónde se guardan mis datos?',
    a: 'En tu base MatuDB asociada al despliegue. Los leads, conversaciones y configuración viven en tu instancia, no en un silo compartido opaco.',
  },
  {
    q: '¿Cómo obtengo ayuda técnica?',
    a: 'Si ya tienes cuenta, usa el centro de ayuda dentro del cockpit (/help). Si aún no eres cliente, escríbenos por el formulario de contacto.',
  },
];

export const SETUP_GUIDES = [
  {
    title: 'Crear cuenta',
    body: 'Ve a Crear cuenta, completa email y contraseña. Se crea tu organización y primer proyecto automáticamente.',
  },
  {
    title: 'Configurar marca',
    body: 'En el asistente de setup o en Ajustes → Marca define sector, ciudad, tono y descripción. Los agentes usan este contexto.',
  },
  {
    title: 'Webhook de WhatsApp',
    body: 'En Meta Developer configura el callback URL que te indica Ajustes → WhatsApp y verifica el token. Luego prueba enviando un mensaje.',
  },
  {
    title: 'Activar Lead Hunter',
    body: 'Desde Agentes activa Lead Hunter con ciudad y sector. Los leads aparecerán en el tablero Kanban cuando el agente termine.',
  },
];
