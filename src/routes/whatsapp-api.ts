import type { FastifyInstance } from 'fastify';
import {
  getConversationById,
  listConversations,
  listMessages,
  resetUnread,
  setConversationMode,
} from '../db/whatsapp.js';
import { sendHumanReply } from '../whatsapp/bot.js';
import { launchCampaign, type CampaignLeadFilter } from '../whatsapp/campaigns.js';
import { isWhatsAppConfigured } from '../whatsapp/client.js';
import { listCampaigns } from '../db/whatsapp.js';

export async function whatsappApiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/whatsapp/status', async () => ({
    configured: isWhatsAppConfigured(),
  }));

  app.get('/api/whatsapp/conversations', async () => ({
    conversations: await listConversations(60),
  }));

  app.get<{ Params: { id: string } }>(
    '/api/whatsapp/conversations/:id/messages',
    async (request, reply) => {
      const conversation = await getConversationById(request.params.id);
      if (!conversation) return reply.code(404).send({ error: 'Conversación no encontrada' });

      const messages = await listMessages(conversation.id);
      await resetUnread(conversation.id).catch(() => undefined);

      return { conversation, messages };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { text?: string; assignedTo?: string };
  }>('/api/whatsapp/conversations/:id/reply', async (request, reply) => {
    const text = request.body?.text?.trim();
    if (!text) return reply.code(400).send({ error: 'text requerido' });

    try {
      await sendHumanReply({
        conversationId: request.params.id,
        text,
        assignedTo: request.body?.assignedTo,
      });
      return { ok: true };
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post<{
    Params: { id: string };
    Body: { mode?: 'bot' | 'human'; assignedTo?: string };
  }>('/api/whatsapp/conversations/:id/mode', async (request, reply) => {
    const mode = request.body?.mode;
    if (mode !== 'bot' && mode !== 'human') {
      return reply.code(400).send({ error: 'mode debe ser bot|human' });
    }
    await setConversationMode(request.params.id, mode, request.body?.assignedTo);
    return { ok: true };
  });

  app.get('/api/whatsapp/campaigns', async () => ({
    campaigns: await listCampaigns(30),
  }));

  app.post<{
    Body: {
      name?: string;
      templateName?: string;
      templateLanguage?: string;
      appSlug?: string;
      bodyParamsTemplate?: string[];
      leadFilter?: CampaignLeadFilter;
      leadIds?: string[];
    };
  }>('/api/whatsapp/campaigns', async (request, reply) => {
    const body = request.body ?? {};
    if (!body.name || !body.templateName) {
      return reply.code(400).send({ error: 'name y templateName son requeridos' });
    }

    try {
      const result = await launchCampaign({
        name: body.name,
        templateName: body.templateName,
        templateLanguage: body.templateLanguage,
        appSlug: body.appSlug,
        bodyParamsTemplate: body.bodyParamsTemplate,
        leadFilter: body.leadFilter,
        leadIds: body.leadIds,
      });
      return { ok: true, ...result };
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
