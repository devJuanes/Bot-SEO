import type { FastifyInstance } from 'fastify';
import {
  countOpenTickets,
  createSupportTicket,
  getSupportTicketById,
  listSupportTickets,
  type SupportTicketCategory,
} from '../db/support.js';

const CATEGORIES = new Set<SupportTicketCategory>([
  'general',
  'technical',
  'whatsapp',
  'facebook',
  'billing',
  'feature',
]);

export async function supportApiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/support/tickets', async (request) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => {
      const tickets = await listSupportTickets({ userId: request.user!.id });
      const openCount = await countOpenTickets(request.user!.id);
      return { tickets, openCount };
    });
  });

  app.get<{ Params: { id: string } }>('/api/support/tickets/:id', async (request, reply) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => {
      const ticket = await getSupportTicketById(request.params.id);
      if (!ticket) return reply.code(404).send({ error: 'Ticket no encontrado' });
      if (ticket.user_id !== request.user!.id) {
        return reply.code(403).send({ error: 'No autorizado' });
      }
      return { ticket };
    });
  });

  app.post<{
    Body: {
      category?: string;
      subject?: string;
      message?: string;
      priority?: string;
    };
  }>('/api/support/tickets', async (request, reply) => {
    const body = request.body ?? {};
    const subject = body.subject?.trim();
    const message = body.message?.trim();
    const category = (body.category?.trim() || 'general') as SupportTicketCategory;

    if (!subject || subject.length < 3) {
      return reply.code(400).send({ error: 'Asunto requerido (mín. 3 caracteres)' });
    }
    if (!message || message.length < 10) {
      return reply.code(400).send({ error: 'Mensaje requerido (mín. 10 caracteres)' });
    }
    if (!CATEGORIES.has(category)) {
      return reply.code(400).send({ error: 'Categoría inválida' });
    }

    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => {
      const ticket = await createSupportTicket({
        userId: request.user!.id,
        category,
        subject,
        message,
        priority: body.priority,
      });
      return { ok: true, ticket };
    });
  });
}
