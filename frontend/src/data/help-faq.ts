export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export const FAQ_CATEGORIES = [
  'Primeros pasos',
  'Leads y agentes',
  'WhatsApp',
  'Facebook',
  'Cuenta y facturación',
  'Técnico',
] as const;

export const HELP_FAQ: FaqItem[] = [
  {
    id: 'setup',
    category: 'Primeros pasos',
    question: '¿Cómo configuro mi proyecto por primera vez?',
    answer:
      'Ve a Ajustes → Proyecto y completa el nombre de tu marca. Luego configura el LLM en Ajustes → LLM/IA, y conecta WhatsApp o Facebook si los vas a usar. El asistente de setup en /setup te guía paso a paso.',
  },
  {
    id: 'agents',
    category: 'Leads y agentes',
    question: '¿Qué hace el agente Lead Hunter?',
    answer:
      'Busca negocios en Google Maps según sector y ciudad, los guarda como leads y detecta oportunidades (sin web, baja reputación, etc.). Puedes activarlo en Agentes y revisar resultados en la sección Leads.',
  },
  {
    id: 'lead-whatsapp',
    category: 'Leads y agentes',
    question: '¿Cómo contacto un lead por WhatsApp?',
    answer:
      'Abre el detalle del lead y pulsa el botón flotante verde de WhatsApp. Se abre un panel lateral con chat, propuestas generadas por IA y envío directo al teléfono del prospecto.',
  },
  {
    id: 'wa-config',
    category: 'WhatsApp',
    question: '¿Qué necesito para conectar WhatsApp Business?',
    answer:
      'Una cuenta de Meta Business, app en developers.facebook.com, token de System User permanente, Phone Number ID y opcionalmente el WABA ID. Configúralo en Ajustes → WhatsApp. El diagnóstico en esa página valida la conexión.',
  },
  {
    id: 'wa-templates',
    category: 'WhatsApp',
    question: '¿Por qué no puedo enviar mensajes libres a un lead nuevo?',
    answer:
      'WhatsApp exige plantillas aprobadas para iniciar conversaciones fuera de la ventana de 24 h. Usa Plantillas para el primer contacto o espera a que el cliente te escriba.',
  },
  {
    id: 'fb-token',
    category: 'Facebook',
    question: 'Mi token de Facebook no publica. ¿Qué reviso?',
    answer:
      'Debe ser un Page Access Token (no user token), con permisos pages_manage_posts y publish_video si subes videos. Verifica en Ajustes → Facebook que el diagnóstico muestre el nombre de tu página.',
  },
  {
    id: 'session',
    category: 'Cuenta y facturación',
    question: '¿Por qué se cierra mi sesión?',
    answer:
      'La sesión dura 7 días. Si ves cierre inesperado, limpia cookies del sitio o vuelve a iniciar sesión. No compartas tu cuenta; cada usuario debe tener el suyo.',
  },
  {
    id: 'billing',
    category: 'Cuenta y facturación',
    question: '¿Dónde veo facturación o cambio de plan?',
    answer:
      'Abre un ticket en Centro de ayuda → Mis tickets con categoría Facturación. El equipo de MatuByte te responde por el mismo canal.',
  },
  {
    id: 'health',
    category: 'Técnico',
    question: 'La app muestra error 502 o no carga. ¿Qué hago?',
    answer:
      'Comprueba tu conexión. Si es en producción (growth.matubyte.com), puede ser mantenimiento breve. Crea un ticket técnico con captura y hora del error.',
  },
  {
    id: 'migrate',
    category: 'Técnico',
    question: '¿Cómo reporto un bug?',
    answer:
      'En Centro de ayuda → Mis tickets, elige categoría Técnico, describe qué hiciste, qué esperabas y qué pasó. Incluye navegador y pasos para reproducir.',
  },
];

export const HELP_QUICK_LINKS = [
  {
    title: 'Configurar WhatsApp',
    description: 'Token, Phone ID y diagnóstico',
    to: '/settings/whatsapp',
  },
  {
    title: 'Configurar Facebook',
    description: 'Page token y permisos',
    to: '/settings/facebook',
  },
  {
    title: 'Ver mis leads',
    description: 'Prospectos detectados por agentes',
    to: '/leads',
  },
  {
    title: 'Agentes IA',
    description: 'Activar y revisar automatizaciones',
    to: '/agentes',
  },
];
