import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  MessageSquare,
  Monitor,
  Settings,
  Share2,
  Users,
  Workflow,
} from 'lucide-react';

export interface NavChild {
  to: string;
  label: string;
  badge?: number;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  base: string;
  railTo: string;
  children: NavChild[];
  featureFlag?: 'content';
}

export interface NavItem {
  type: 'link';
  to: string;
  label: string;
  icon: LucideIcon;
  featureFlag?: 'content';
}

export const RAIL_ITEMS: Array<{
  to: string;
  icon: LucideIcon;
  label: string;
  match: string;
  featureFlag?: 'content';
}> = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', match: '/dashboard' },
  { to: '/agentes', icon: Bot, label: 'Agentes', match: '/agentes' },
  { to: '/leads', icon: Users, label: 'Leads', match: '/leads' },
  { to: '/automations', icon: Workflow, label: 'Flujos', match: '/automations' },
  { to: '/monitor', icon: Monitor, label: 'Monitor', match: '/monitor' },
  { to: '/content', icon: FileText, label: 'Contenido', match: '/content', featureFlag: 'content' },
  { to: '/whatsapp/mensajes', icon: MessageCircle, label: 'WhatsApp', match: '/whatsapp' },
  { to: '/facebook/queue', icon: Share2, label: 'Facebook', match: '/facebook' },
  { to: '/chat', icon: MessageSquare, label: 'Chat IA', match: '/chat' },
  { to: '/help', icon: LifeBuoy, label: 'Ayuda', match: '/help' },
  { to: '/settings/project', icon: Settings, label: 'Ajustes', match: '/settings' },
];

export const NAV_TREE: Array<NavItem | NavGroup> = [
  { type: 'link', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { type: 'link', to: '/agentes', label: 'Agentes', icon: Bot },
  { type: 'link', to: '/leads', label: 'Leads', icon: Users },
  { type: 'link', to: '/automations', label: 'Flujos', icon: Workflow },
  { type: 'link', to: '/monitor', label: 'Monitor', icon: Monitor },
  {
    type: 'link',
    to: '/content',
    label: 'Contenido',
    icon: FileText,
    featureFlag: 'content',
  },
  { type: 'link', to: '/chat', label: 'Chat de empresa', icon: MessageSquare },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    base: '/whatsapp',
    railTo: '/whatsapp/mensajes',
    children: [
      { to: '/whatsapp/mensajes', label: 'Mensajes' },
      { to: '/whatsapp/campaigns', label: 'Campañas' },
      { to: '/whatsapp/contacts', label: 'Contactos' },
      { to: '/whatsapp/templates', label: 'Plantillas' },
    ],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: Share2,
    base: '/facebook',
    railTo: '/facebook/queue',
    children: [
      { to: '/facebook/queue', label: 'Cola de publicación' },
      { to: '/facebook/published', label: 'Publicados' },
      { to: '/facebook/generate', label: 'Generar contenido' },
    ],
  },
  {
    id: 'settings',
    label: 'Ajustes',
    icon: Settings,
    base: '/settings',
    railTo: '/settings/project',
    children: [
      { to: '/settings/project', label: 'Proyecto' },
      { to: '/settings/llm', label: 'LLM / IA' },
      { to: '/settings/whatsapp', label: 'WhatsApp' },
      { to: '/settings/facebook', label: 'Facebook' },
      { to: '/settings/brand', label: 'Marca' },
    ],
  },
  {
    id: 'help',
    label: 'Centro de ayuda',
    icon: LifeBuoy,
    base: '/help',
    railTo: '/help',
    children: [
      { to: '/help', label: 'Inicio' },
      { to: '/help/faq', label: 'Preguntas frecuentes' },
      { to: '/help/tickets', label: 'Mis tickets' },
      { to: '/help/contact', label: 'Contactar soporte' },
    ],
  },
];

export function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
  return 'children' in item;
}
