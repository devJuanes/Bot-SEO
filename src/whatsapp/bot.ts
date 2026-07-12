import { env } from '../config/env.js';
import { buildKnowledgeContext } from '../db/growth.js';
import { getMatuByteSummary } from '../knowledge/matubyte.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';
import {
  getConversationById,
  getOrCreateConversation,
  listMessages,
  saveMessage,
  setConversationMode,
  type WhatsAppConversation,
} from '../db/whatsapp.js';
import { sendTextMessage } from './client.js';

const AGENT_LABEL = 'whatsapp-bot';

function getHandoffKeywords(): string[] {
  return env.WHATSAPP_HANDOFF_KEYWORDS.split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

function matchesHandoff(text: string): boolean {
  const normalized = text.toLowerCase();
  return getHandoffKeywords().some((keyword) => normalized.includes(keyword));
}

async function generateBotReply(
  conversation: WhatsAppConversation,
  incomingText: string,
): Promise<string> {
  const brand = getMatuByteSummary();
  const knowledge = await buildKnowledgeContext();
  const history = await listMessages(conversation.id, 12);

  const messages = [
    {
      role: 'system' as const,
      content: `Eres el asistente de ventas de WhatsApp de ${brand.company} (${brand.hq}).
Respondes rápido, en español, cercano y profesional — como un vendedor humano, sin sonar robótico.
Objetivo: entender la necesidad del cliente y avanzar hacia una cita/cotización.
Si el cliente pide hablar con una persona, o el tema es muy específico/técnico/comercial delicado, dilo claramente para que un humano tome el control.
Nunca inventes precios exactos ni plazos que no estén en el knowledge. Sé breve (máx 4-5 líneas).

Knowledge MatuByte:
${knowledge.slice(0, 5000)}`,
    },
    ...history.slice(-10).map((m) => ({
      role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: incomingText },
  ];

  const completion = await chatCompletion({
    temperature: 0.6,
    maxTokens: 400,
    messages,
  });

  return completion.content.trim();
}

export async function handleIncomingWhatsAppMessage(input: {
  waId: string;
  profileName?: string | null;
  text: string;
  waMessageId?: string | null;
}): Promise<void> {
  const conversation = await getOrCreateConversation({
    waId: input.waId,
    profileName: input.profileName,
  });

  await saveMessage({
    conversationId: conversation.id,
    waMessageId: input.waMessageId,
    direction: 'inbound',
    senderType: 'customer',
    content: input.text,
  });

  pushLog({
    level: 'info',
    agentId: AGENT_LABEL,
    message: `Inbound · ${input.profileName ?? input.waId}: ${input.text.slice(0, 80)}`,
  });

  if (conversation.mode === 'human') {
    // Si el humano (o el bot) ya respondió el último mensaje, el cliente está
    // escribiendo de nuevo → retomamos el bot automáticamente. Si el último
    // mensaje sigue siendo inbound (o un system ack de handoff), todavía estamos
    // esperando al humano.
    const recent = await listMessages(conversation.id, 2);
    const previous = recent.length >= 2 ? recent[recent.length - 2] : null;
    const alreadyReplied =
      previous?.direction === 'outbound' &&
      (previous.sender_type === 'human' || previous.sender_type === 'bot');

    if (!alreadyReplied) {
      sendAgentMessage({
        from: 'whatsapp-bot',
        to: 'broadcast',
        topic: 'whatsapp.human_pending',
        body: `Nuevo mensaje en conversación humana: ${input.profileName ?? input.waId}`,
        payload: { conversationId: conversation.id },
      });
      return;
    }

    await setConversationMode(conversation.id, 'bot').catch(() => undefined);
    pushLog({
      level: 'info',
      agentId: AGENT_LABEL,
      message: `Bot retoma conversación · ${input.profileName ?? input.waId}`,
    });
  }

  if (matchesHandoff(input.text)) {
    await setConversationMode(conversation.id, 'human');
    const ack =
      'Listo, ya te conecto con alguien del equipo de MatuByte. En unos minutos te escriben por aquí mismo. 🙌';

    try {
      const result = await sendTextMessage(input.waId, ack);
      await saveMessage({
        conversationId: conversation.id,
        waMessageId: result.waMessageId,
        direction: 'outbound',
        senderType: 'system',
        content: ack,
      });
    } catch (err) {
      pushLog({
        level: 'error',
        agentId: AGENT_LABEL,
        message: `No se pudo enviar ack de handoff: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    sendAgentMessage({
      from: 'whatsapp-bot',
      to: 'broadcast',
      topic: 'whatsapp.handoff',
      body: `${input.profileName ?? input.waId} pidió hablar con un humano`,
      payload: { conversationId: conversation.id, waId: input.waId },
    });
    return;
  }

  if (!isLlmConfigured()) {
    pushLog({
      level: 'error',
      agentId: AGENT_LABEL,
      message: 'LLM no configurado — no se puede responder automáticamente',
    });
    return;
  }

  try {
    const reply = await generateBotReply(conversation, input.text);
    const result = await sendTextMessage(input.waId, reply);

    await saveMessage({
      conversationId: conversation.id,
      waMessageId: result.waMessageId,
      direction: 'outbound',
      senderType: 'bot',
      content: reply,
    });

    pushLog({
      level: 'success',
      agentId: AGENT_LABEL,
      message: `Reply · ${input.profileName ?? input.waId}: ${reply.slice(0, 80)}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pushLog({
      level: 'error',
      agentId: AGENT_LABEL,
      message: `Fallo generando/enviando respuesta: ${message}`,
    });

    // No cambiamos a modo human — así el siguiente mensaje del cliente reintenta
    // con el bot en lugar de quedar pegado esperando un humano que nunca llega.
    sendAgentMessage({
      from: 'whatsapp-bot',
      to: 'broadcast',
      topic: 'whatsapp.bot_error',
      body: `Error respondiendo a ${input.profileName ?? input.waId}`,
      payload: { conversationId: conversation.id, error: message },
    });
  }
}

export async function sendHumanReply(input: {
  conversationId: string;
  text: string;
  assignedTo?: string;
}): Promise<void> {
  const conversation = await getConversationById(input.conversationId);
  if (!conversation) throw new Error('Conversación no encontrada');

  if (conversation.mode !== 'human') {
    await setConversationMode(conversation.id, 'human', input.assignedTo);
  }

  const result = await sendTextMessage(conversation.wa_id, input.text);

  await saveMessage({
    conversationId: conversation.id,
    waMessageId: result.waMessageId,
    direction: 'outbound',
    senderType: 'human',
    content: input.text,
  });

  pushLog({
    level: 'info',
    agentId: AGENT_LABEL,
    message: `Human reply · ${conversation.profile_name ?? conversation.wa_id}`,
  });
}
