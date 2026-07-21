import type { FastifyInstance } from 'fastify';
import { getLeadById, getLeadStats, listLeadsKanban, listLeadsPaginated, updateLeadStatus, isValidLeadStatus } from '../db/leads.js';
import { listLeadStatusEvents } from '../db/automation.js';
import {
  findConversationByLeadId,
  getOrCreateConversation,
  linkConversationToLead,
  listMessages,
  resetUnread,
} from '../db/whatsapp.js';
import { sendHumanReply } from '../whatsapp/bot.js';
import { isWhatsAppConfigured } from '../whatsapp/client.js';
import {
  generateLeadProposals,
  leadPhoneToWaId,
} from '../services/lead-whatsapp.js';

export async function leadsApiRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      search?: string;
      status?: string;
      source?: string;
    };
  }>('/api/leads', async (request) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => {
      const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 25)));
      const offset = Math.max(0, Number(request.query.offset ?? 0));
      return listLeadsPaginated({
        limit,
        offset,
        search: request.query.search,
        status: request.query.status,
        source: request.query.source,
      });
    });
  });

  app.get('/api/leads/kanban', async (request) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => listLeadsKanban(80));
  });

  app.get<{ Params: { id: string } }>(
    '/api/leads/:id/history',
    async (request, reply) => {
      const { withRequestTenant } = await import('../tenancy/context.js');
      return withRequestTenant(request.tenant, async () => {
        const lead = await getLeadById(request.params.id);
        if (!lead) return reply.code(404).send({ error: 'Lead no encontrado' });
        const events = await listLeadStatusEvents(request.params.id);
        return { events };
      });
    },
  );

  app.get('/api/leads/stats', async (request) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => getLeadStats());
  });

  app.get<{ Params: { id: string } }>('/api/leads/:id', async (request, reply) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => {
      const lead = await getLeadById(request.params.id);
      if (!lead) return reply.code(404).send({ error: 'Lead no encontrado' });
      return { lead };
    });
  });

  app.patch<{ Params: { id: string }; Body: { status?: string } }>(
    '/api/leads/:id',
    async (request, reply) => {
      const { withRequestTenant } = await import('../tenancy/context.js');
      return withRequestTenant(request.tenant, async () => {
        const status = request.body?.status?.trim();
        if (!status) return reply.code(400).send({ error: 'status requerido' });
        if (!isValidLeadStatus(status)) {
          return reply.code(400).send({ error: 'Estado inválido' });
        }
        try {
          const lead = await updateLeadStatus(request.params.id, status, {
            changedBy: request.user?.id ?? 'user',
          });
          if (!lead) return reply.code(404).send({ error: 'Lead no encontrado' });
          return { lead };
        } catch (err) {
          return reply.code(400).send({
            error: err instanceof Error ? err.message : 'No se pudo actualizar',
          });
        }
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/leads/:id/whatsapp',
    async (request, reply) => {
      const { withRequestTenant } = await import('../tenancy/context.js');
      try {
        return await withRequestTenant(request.tenant, async () => {
          const lead = await getLeadById(request.params.id);
          if (!lead) return reply.code(404).send({ error: 'Lead no encontrado' });

          const configured = await isWhatsAppConfigured();
          const waId = leadPhoneToWaId(lead.phone);

          if (!configured) {
            return {
              configured: false,
              hasPhone: Boolean(waId),
              waId,
              conversation: null,
              messages: [],
            };
          }

          if (!waId) {
            return {
              configured: true,
              hasPhone: false,
              waId: null,
              conversation: null,
              messages: [],
              error: 'Este lead no tiene teléfono válido para WhatsApp.',
            };
          }

          let conversation =
            (await findConversationByLeadId(lead.id)) ??
            (await getOrCreateConversation({
              waId,
              profileName: lead.name,
            }));

          if (!conversation.lead_id) {
            await linkConversationToLead(conversation.id, lead.id);
            conversation = { ...conversation, lead_id: lead.id };
          }

          const messages = await listMessages(conversation.id);
          await resetUnread(conversation.id).catch(() => undefined);

          return {
            configured: true,
            hasPhone: true,
            waId,
            conversation: {
              id: conversation.id,
              wa_id: conversation.wa_id,
              mode: conversation.mode,
              unread_count: conversation.unread_count,
              profile_name: conversation.profile_name,
            },
            messages: messages.map((m) => ({
              id: m.id,
              direction: m.direction,
              body: m.content,
              sender_type: m.sender_type,
              created_at: m.created_at,
            })),
          };
        });
      } catch (err) {
        request.log.error({ err }, 'lead whatsapp load');
        return reply.code(500).send({
          error: err instanceof Error ? err.message : 'Error al cargar WhatsApp del lead',
        });
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { text?: string } }>(
    '/api/leads/:id/whatsapp/reply',
    async (request, reply) => {
      const text = request.body?.text?.trim();
      if (!text) return reply.code(400).send({ error: 'text requerido' });

      const { withRequestTenant } = await import('../tenancy/context.js');
      return withRequestTenant(request.tenant, async () => {
        if (!(await isWhatsAppConfigured())) {
          return reply.code(409).send({
            error: 'WhatsApp no configurado. Ve a Ajustes → WhatsApp.',
          });
        }

        const lead = await getLeadById(request.params.id);
        if (!lead) return reply.code(404).send({ error: 'Lead no encontrado' });

        const waId = leadPhoneToWaId(lead.phone);
        if (!waId) {
          return reply.code(400).send({ error: 'Este lead no tiene teléfono válido.' });
        }

        const conversation = await getOrCreateConversation({
          waId,
          profileName: lead.name,
        });
        await linkConversationToLead(conversation.id, lead.id);

        await sendHumanReply({
          conversationId: conversation.id,
          text,
        });

        if (lead.status === 'new') {
          await updateLeadStatus(lead.id, 'contacted');
        }

        const messages = await listMessages(conversation.id);
        return {
          ok: true,
          conversationId: conversation.id,
          messages: messages.map((m) => ({
            id: m.id,
            direction: m.direction,
            body: m.content,
            sender_type: m.sender_type,
            created_at: m.created_at,
          })),
        };
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/leads/:id/whatsapp/proposals',
    async (request, reply) => {
      const { withRequestTenant } = await import('../tenancy/context.js');
      return withRequestTenant(request.tenant, async () => {
        const lead = await getLeadById(request.params.id);
        if (!lead) return reply.code(404).send({ error: 'Lead no encontrado' });

        const proposals = await generateLeadProposals(lead);
        return { proposals };
      });
    },
  );
}
