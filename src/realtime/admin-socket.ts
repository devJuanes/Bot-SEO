import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import {
  onRuntimeEvent,
  type AgentBusMessage,
} from '../runtime/state.js';

export type AdminNotifyChannel = 'leads' | 'facebook' | 'whatsapp' | 'system';

export interface AdminNotifyPayload {
  type: 'notify';
  channel: AdminNotifyChannel;
  topic: string;
  title: string;
  body: string;
  /** Android tab deep-link hint */
  tab: 'leads' | 'posts' | 'whatsapp' | 'settings';
  payload?: Record<string, unknown>;
  ts: string;
}

let io: Server | null = null;
let busWired = false;

const TOPIC_CHANNEL: Record<
  string,
  { channel: AdminNotifyChannel; tab: AdminNotifyPayload['tab']; title: string }
> = {
  'leads.created': { channel: 'leads', tab: 'leads', title: 'Nuevo lead' },
  'leads.batch': { channel: 'leads', tab: 'leads', title: 'Leads' },
  'leads.phones': { channel: 'leads', tab: 'leads', title: 'Leads' },
  'facebook.pending_review': {
    channel: 'facebook',
    tab: 'posts',
    title: 'Post pendiente',
  },
  'facebook.published': {
    channel: 'facebook',
    tab: 'posts',
    title: 'Post publicado',
  },
  'facebook.rejected': {
    channel: 'facebook',
    tab: 'posts',
    title: 'Post rechazado',
  },
  'whatsapp.handoff': {
    channel: 'whatsapp',
    tab: 'whatsapp',
    title: 'WhatsApp · humano',
  },
  'whatsapp.human_pending': {
    channel: 'whatsapp',
    tab: 'whatsapp',
    title: 'WhatsApp · pendiente',
  },
  'whatsapp.bot_error': {
    channel: 'whatsapp',
    tab: 'whatsapp',
    title: 'WhatsApp · error',
  },
  'whatsapp.campaign_completed': {
    channel: 'whatsapp',
    tab: 'whatsapp',
    title: 'Campaña WhatsApp',
  },
  'facebook.comment': {
    channel: 'facebook',
    tab: 'posts',
    title: 'Comentario FB',
  },
  'fb.lead': { channel: 'leads', tab: 'leads', title: 'Lead Facebook' },
};

function mapBusMessage(msg: AgentBusMessage): AdminNotifyPayload | null {
  const meta = TOPIC_CHANNEL[msg.topic];
  if (!meta) return null;
  return {
    type: 'notify',
    channel: meta.channel,
    topic: msg.topic,
    title: meta.title,
    body: msg.body.slice(0, 280),
    tab: meta.tab,
    payload: msg.payload,
    ts: msg.ts,
  };
}

/** Attach Socket.IO on the same HTTP server as Fastify (path /socket.io). */
export function attachAdminSocket(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    socket.join('admin');
    socket.emit('admin:hello', {
      ok: true,
      service: 'matubyte-growth-factory',
      room: 'admin',
    });
    socket.on('subscribe', (payload?: { room?: string }) => {
      const room = payload?.room || 'admin';
      socket.join(room);
      socket.emit('admin:subscribed', { room });
    });
  });

  if (!busWired) {
    busWired = true;
    onRuntimeEvent('message', (payload) => {
      const msg = payload as AgentBusMessage;
      const notify = mapBusMessage(msg);
      if (notify) broadcastAdminNotify(notify);
    });
  }

  return io;
}

export function getAdminSocket(): Server | null {
  return io;
}

export function broadcastAdminNotify(notify: AdminNotifyPayload): void {
  io?.to('admin').emit('admin:notify', notify);
}

export function adminSocketStats(): {
  connected: boolean;
  clients: number;
} {
  if (!io) return { connected: false, clients: 0 };
  return {
    connected: true,
    clients: io.sockets.sockets.size,
  };
}
