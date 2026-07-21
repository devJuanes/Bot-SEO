import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  getConversationById,
  getOrCreateConversation,
  getTotalUnreadCount,
  listConversations,
  listFailedCampaignTargets,
  listMessages,
  resetUnread,
  saveMessage,
  setConversationMode,
} from '../db/whatsapp.js';
import { sendHumanReply } from '../whatsapp/bot.js';
import {
  launchCampaign,
  resumeCampaign,
  type CampaignLeadFilter,
} from '../whatsapp/campaigns.js';
import {
  isWhatsAppConfigured,
  listMessageTemplates,
  sendTemplateMessage,
} from '../whatsapp/client.js';
import { completeCampaign, listCampaigns } from '../db/whatsapp.js';

async function withTenant<T>(
  request: FastifyRequest,
  fn: () => Promise<T>,
): Promise<T> {
  const { withRequestTenant } = await import('../tenancy/context.js');
  return withRequestTenant(request.tenant, fn);
}

export async function whatsappApiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/whatsapp/status', async (request) =>
    withTenant(request, async () => ({
      configured: await isWhatsAppConfigured(),
    })),
  );

  /**
   * Valida token + phone number ID contra Graph sin exponer el token.
   * Si ves ok:false con status 401 → regenera WHATSAPP_ACCESS_TOKEN (System User permanente).
   */
  app.get('/api/whatsapp/diagnostics', async (request) =>
    withTenant(request, async () => {
    if (!(await isWhatsAppConfigured())) {
      return {
        ok: false,
        configured: false,
        hint: 'Configura WhatsApp en Ajustes del proyecto',
      };
    }

    const { tryLoadCurrentProjectConfig } = await import(
      '../tenancy/project-config.js'
    );
    const { env } = await import('../config/env.js');
    const cfg = await tryLoadCurrentProjectConfig().catch(() => null);
    const phone =
      cfg?.whatsapp.phoneNumberId || env.WHATSAPP_PHONE_NUMBER_ID!;
    const token = cfg?.whatsapp.accessToken || env.WHATSAPP_ACCESS_TOKEN!;
    const ver = env.WHATSAPP_API_VERSION;

    try {
      const res = await fetch(
        `https://graph.facebook.com/${ver}/${phone}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: { message?: string; code?: number; type?: string };
        display_phone_number?: string;
        verified_name?: string;
        quality_rating?: string;
      };

      if (!res.ok) {
        return {
          ok: false,
          configured: true,
          httpStatus: res.status,
          errorCode: body.error?.code ?? null,
          errorType: body.error?.type ?? null,
          errorMessage: body.error?.message ?? res.statusText,
          hint:
            res.status === 401
              ? 'Token inválido o expirado. Crea un System User permanente en Meta Business Manager (no uses el token de prueba de 24h). Reinicia el bot tras pegar WHATSAPP_ACCESS_TOKEN.'
              : 'Revisa que el Phone Number ID pertenezca a la misma app/WABA del token.',
        };
      }

      return {
        ok: true,
        configured: true,
        httpStatus: res.status,
        displayPhone: body.display_phone_number ?? null,
        verifiedName: body.verified_name ?? null,
        qualityRating: body.quality_rating ?? null,
        tokenLength: token.length,
        phoneNumberId: phone,
      };
    } catch (err) {
      return {
        ok: false,
        configured: true,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
    }),
  );

  app.get('/api/whatsapp/unread-count', async (request, reply) => {
    try {
      return await withTenant(request, async () => {
        if (!(await isWhatsAppConfigured())) {
          return { unread: 0, configured: false };
        }
        return {
          unread: await getTotalUnreadCount(),
          configured: true,
        };
      });
    } catch (err) {
      request.log.error({ err }, 'whatsapp unread-count');
      return reply.code(500).send({ unread: 0, error: 'Error al cargar no leídos' });
    }
  });

  app.get('/api/whatsapp/conversations', async (request, reply) => {
    try {
      return await withTenant(request, async () => {
        if (!(await isWhatsAppConfigured())) {
          return { conversations: [], configured: false };
        }
        return {
          conversations: await listConversations(200),
          configured: true,
        };
      });
    } catch (err) {
      request.log.error({ err }, 'whatsapp conversations');
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'Error al cargar conversaciones',
        conversations: [],
      });
    }
  });

  app.get<{
    Params: { id: string };
    Querystring: { markRead?: string };
  }>(
    '/api/whatsapp/conversations/:id/messages',
    async (request, reply) => {
      try {
        return await withTenant(request, async () => {
          if (!(await isWhatsAppConfigured())) {
            return reply.code(409).send({
              error: 'WhatsApp no configurado. Ve a Ajustes → WhatsApp.',
            });
          }
          const conversation = await getConversationById(request.params.id);
          if (!conversation) {
            return reply.code(404).send({ error: 'Conversación no encontrada' });
          }

          const messages = await listMessages(conversation.id);
          const shouldMarkRead = request.query.markRead !== '0';
          if (shouldMarkRead) {
            await resetUnread(conversation.id).catch(() => undefined);
          }

          return {
            conversation,
            messages: messages.map((m) => ({
              id: m.id,
              direction: m.direction,
              body: m.content,
              created_at: m.created_at,
              sender_type: m.sender_type,
              message_type: m.message_type,
            })),
          };
        });
      } catch (err) {
        return reply.code(500).send({
          error: err instanceof Error ? err.message : 'Error al cargar mensajes',
        });
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: { text?: string; assignedTo?: string };
  }>('/api/whatsapp/conversations/:id/reply', async (request, reply) => {
    const text = request.body?.text?.trim();
    if (!text) return reply.code(400).send({ error: 'text requerido' });

    try {
      return await withTenant(request, async () => {
        if (!(await isWhatsAppConfigured())) {
          return reply.code(409).send({
            error: 'WhatsApp no configurado. Ve a Ajustes → WhatsApp.',
          });
        }
        await sendHumanReply({
          conversationId: request.params.id,
          text,
          assignedTo: request.body?.assignedTo,
        });
        return { ok: true };
      });
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
    try {
      return await withTenant(request, async () => {
        await setConversationMode(request.params.id, mode, request.body?.assignedTo);
        return { ok: true };
      });
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/whatsapp/campaigns', async (request, reply) => {
    try {
      return await withTenant(request, async () => {
        if (!(await isWhatsAppConfigured())) {
          return { campaigns: [], configured: false };
        }
        return { campaigns: await listCampaigns(30), configured: true };
      });
    } catch (err) {
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'Error al cargar campañas',
        campaigns: [],
      });
    }
  });

  app.get('/api/whatsapp/templates', async (request, reply) => {
    try {
      return await withTenant(request, async () => {
        if (!(await isWhatsAppConfigured())) {
          return {
            templates: [],
            configured: false,
            error: 'WhatsApp no configurado. Ve a Ajustes → WhatsApp.',
          };
        }
        const templates = await listMessageTemplates();
        return { templates, configured: true };
      });
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : String(err),
        templates: [],
      });
    }
  });

  app.post<{ Params: { id: string } }>(
    '/api/whatsapp/campaigns/:id/cancel',
    async (request, reply) => {
      try {
        return await withTenant(request, async () => {
          await completeCampaign(request.params.id);
          return { ok: true };
        });
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: { bodyParamsTemplate?: string[] };
  }>('/api/whatsapp/campaigns/:id/resume', async (request, reply) => {
    try {
      return await withTenant(request, async () => {
        const result = await resumeCampaign(
          request.params.id,
          request.body?.bodyParamsTemplate ?? ['{{name}}'],
        );
        return { ok: true, ...result };
      });
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get<{ Params: { id: string } }>(
    '/api/whatsapp/campaigns/:id/failures',
    async (request, reply) => {
      try {
        return await withTenant(request, async () => ({
          failures: await listFailedCampaignTargets(request.params.id, 8),
        }));
      } catch (err) {
        return reply.code(500).send({
          error: err instanceof Error ? err.message : 'Error al cargar fallos',
          failures: [],
        });
      }
    },
  );

  /** Prueba 1 envío de plantilla a un número (sin campaña masiva). */
  app.post<{
    Body: {
      to?: string;
      templateName?: string;
      templateLanguage?: string;
      bodyParams?: string[];
    };
  }>('/api/whatsapp/templates/test', async (request, reply) => {
    const body = request.body ?? {};
    const to = String(body.to ?? '').replace(/\D/g, '');
    if (!to || to.length < 10) {
      return reply.code(400).send({ error: 'to (teléfono) requerido, ej: 573001112233' });
    }
    if (!body.templateName) {
      return reply.code(400).send({ error: 'templateName requerido' });
    }
    const templateName = body.templateName;
    const templateLanguage = body.templateLanguage || 'es';
    try {
      return await withTenant(request, async () => {
      if (!(await isWhatsAppConfigured())) {
        return reply.code(409).send({
          error: 'WhatsApp no configurado. Ve a Ajustes → WhatsApp.',
        });
      }
      // Valida que la plantilla exista en ESTA WABA antes de enviar.
      const templates = await listMessageTemplates().catch(() => []);
      const match = templates.find(
        (t) =>
          t.name === templateName &&
          t.language === templateLanguage &&
          t.status === 'APPROVED',
      );
      if (templates.length && !match) {
        const available = templates
          .map((t) => `${t.name}/${t.language}/${t.status}`)
          .join(', ');
        return reply.code(400).send({
          error: `Plantilla no disponible en esta WABA. Pediste ${templateName}/${templateLanguage}. Disponibles: ${available || '(ninguna)'}`,
        });
      }

      const result = await sendTemplateMessage(
        to,
        templateName,
        templateLanguage,
        body.bodyParams ?? [],
      );

      const conversation = await getOrCreateConversation({
        waId: to,
        profileName: null,
      });
      const paramText = (body.bodyParams ?? []).filter(Boolean).join(' · ');
      await saveMessage({
        conversationId: conversation.id,
        waMessageId: result.waMessageId,
        direction: 'outbound',
        senderType: 'human',
        content: paramText
          ? `[Plantilla ${templateName}] ${paramText}`
          : `[Plantilla ${templateName}]`,
        messageType: 'template',
        templateName,
      });

      return { ok: true, ...result };
      });
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post<{
    Body: {
      name?: string;
      templateName?: string;
      templateLanguage?: string;
      appSlug?: string;
      bodyParamsTemplate?: string[];
      leadFilter?: CampaignLeadFilter;
      leadIds?: string[];
      /** Si se envía, SOLO manda a este WhatsApp (prueba local). */
      testTo?: string;
    };
  }>('/api/whatsapp/campaigns', async (request, reply) => {
    const body = request.body ?? {};
    const name = body.name?.trim();
    const templateName = body.templateName?.trim();
    if (!name || !templateName) {
      return reply.code(400).send({ error: 'name y templateName son requeridos' });
    }

    try {
      return await withTenant(request, async () => {
      if (!(await isWhatsAppConfigured())) {
        return reply.code(409).send({
          error: 'WhatsApp no configurado. Ve a Ajustes → WhatsApp.',
        });
      }
      // Bloquea campañas masivas con plantillas que no existen en esta WABA.
      const templates = await listMessageTemplates().catch(() => []);
      const lang = body.templateLanguage || 'es';
      if (templates.length) {
        const match = templates.find(
          (t) => t.name === templateName && t.language === lang && t.status === 'APPROVED',
        );
        if (!match) {
          const available = templates
            .map((t) => `${t.name}/${t.language}/${t.status}`)
            .join(', ');
          return reply.code(400).send({
            error: `Plantilla ${templateName}/${lang} no está APPROVED en esta WABA. Disponibles: ${available}`,
          });
        }
      }

      // Modo prueba: un solo número, sin tocar los 278 leads.
      if (body.testTo) {
        const to = String(body.testTo).replace(/\D/g, '');
        const params = (body.bodyParamsTemplate ?? []).map((p) =>
          p.replaceAll('{{name}}', 'Juan').replaceAll('{{sector}}', 'software').replaceAll('{{city}}', 'Cali'),
        );
        const result = await sendTemplateMessage(to, templateName, lang, params);
        const conversation = await getOrCreateConversation({
          waId: to,
          profileName: null,
        });
        await saveMessage({
          conversationId: conversation.id,
          waMessageId: result.waMessageId,
          direction: 'outbound',
          senderType: 'human',
          content: `[Plantilla ${templateName}] ${params.join(' · ')}`,
          messageType: 'template',
          templateName,
        });
        return { ok: true, mode: 'test', to, ...result };
      }

      const result = await launchCampaign({
        name,
        templateName,
        templateLanguage: body.templateLanguage,
        appSlug: body.appSlug,
        bodyParamsTemplate: body.bodyParamsTemplate,
        leadFilter: body.leadFilter,
        leadIds: body.leadIds,
      });
      return { ok: true, ...result };
      });
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
