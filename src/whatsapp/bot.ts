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

/** Mensaje corto y humano al pasar el chat a un asesor. */
const HANDOFF_ACK =
  'Perfecto. Te dejo con un asesor de MatuByte para que revise tu caso y te arme la propuesta con calma. Te escriben por aquí mismo en un momento.';

const HANDOFF_ACK_MARKER = 'te dejo con un asesor de matubyte';

function getHandoffKeywords(): string[] {
  return env.WHATSAPP_HANDOFF_KEYWORDS.split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

/** Match por palabra completa — evita que "asesor" dispare con "asesorarte". */
function matchesHandoff(text: string): boolean {
  const normalized = text.toLowerCase();
  return getHandoffKeywords().some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?:$|[^\\p{L}\\p{N}_])`, 'iu');
    return re.test(normalized);
  });
}

/** Detecta respuestas automáticas de otro bot / negocio (anti-loop). */
function looksLikeBotAutoresponse(text: string): boolean {
  const t = text.toLowerCase();
  const signals = [
    /no puedo responder/,
    /estoy disponible para asesorarte/,
    /gestionar tu cita/,
    /soy (un|el) (asistente|bot|agente virtual)/,
    /mensaje autom[aá]tico/,
    /fuera de horario/,
    /gracias por (escribir|contactar|comunicarte)/,
    /en breve (te|nos) (contactamos|comunicamos)/,
    /este n[uú]mero (no|solo) (atiende|recibe)/,
  ];
  return signals.some((re) => re.test(t));
}

async function recentlySentHandoffAck(conversationId: string): Promise<boolean> {
  const recent = await listMessages(conversationId, 8);
  return recent.some(
    (m) =>
      m.direction === 'outbound' &&
      (m.sender_type === 'system' || m.sender_type === 'bot') &&
      (m.content.toLowerCase().includes(HANDOFF_ACK_MARKER) ||
        m.content.includes('ya te conecto con alguien del equipo') ||
        m.content.toLowerCase().includes('un asesor') &&
          (m.content.toLowerCase().includes('recibí tu') ||
            m.content.toLowerCase().includes('te escribe por aquí'))),
  );
}

async function countRecentBotLoop(conversationId: string): Promise<number> {
  const recent = await listMessages(conversationId, 10);
  let streak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (m.direction === 'outbound' && (m.sender_type === 'bot' || m.sender_type === 'system')) {
      streak += 1;
      continue;
    }
    if (m.direction === 'inbound' && looksLikeBotAutoresponse(m.content)) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

/** Avisa a tu WhatsApp personal cuando hay handoff o mensaje pendiente. */
async function notifyOwnerWhatsApp(text: string): Promise<void> {
  const owner = env.WHATSAPP_OWNER_PHONE;
  if (!owner) {
    pushLog({
      level: 'warn',
      agentId: AGENT_LABEL,
      message:
        'Handoff sin WHATSAPP_OWNER_PHONE — configura tu número en .env para recibir avisos por WhatsApp',
    });
    return;
  }

  try {
    await sendTextMessage(owner, text);
    pushLog({
      level: 'success',
      agentId: AGENT_LABEL,
      message: `Aviso enviado al dueño (${owner})`,
    });
  } catch (err) {
    pushLog({
      level: 'error',
      agentId: AGENT_LABEL,
      message: `No se pudo avisar al dueño por WhatsApp: ${err instanceof Error ? err.message : String(err)}. Abre /wa.html y responde manualmente. (Meta solo entrega si escribiste a ese número en las últimas 24h, o usa plantilla.)`,
    });
  }
}

function ownerAlertText(input: {
  profileName?: string | null;
  waId: string;
  lastMessage: string;
  reason: string;
  conversationId: string;
}): string {
  const who = input.profileName?.trim() || input.waId;
  const preview = input.lastMessage.replace(/\s+/g, ' ').slice(0, 160);
  return [
    `🔔 MatuByte · ${input.reason}`,
    `Cliente: ${who}`,
    `WhatsApp: ${input.waId}`,
    `Dijo: "${preview}"`,
    `Abre el chat en /wa.html?id=${input.conversationId} y responde tú (modo humano).`,
  ].join('\n');
}

async function handoffToHuman(input: {
  conversation: WhatsAppConversation;
  waId: string;
  profileName?: string | null;
  lastMessage: string;
  reason: string;
  sendAckToCustomer: boolean;
  customAck?: string;
}): Promise<void> {
  await setConversationMode(input.conversation.id, 'human');

  if (input.sendAckToCustomer) {
    const alreadyAcked = await recentlySentHandoffAck(input.conversation.id);
    if (!alreadyAcked) {
      const ack = input.customAck || HANDOFF_ACK;
      try {
        const result = await sendTextMessage(input.waId, ack);
        await saveMessage({
          conversationId: input.conversation.id,
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
    }
  }

  sendAgentMessage({
    from: 'whatsapp-bot',
    to: 'broadcast',
    topic: 'whatsapp.handoff',
    body: `${input.profileName ?? input.waId}: ${input.reason}`,
    payload: {
      conversationId: input.conversation.id,
      waId: input.waId,
      reason: input.reason,
    },
  });

  // No avisar al dueño si el mensaje viene de su propio número.
  if (env.WHATSAPP_OWNER_PHONE && input.waId.replace(/\D/g, '') === env.WHATSAPP_OWNER_PHONE) {
    return;
  }

  await notifyOwnerWhatsApp(
    ownerAlertText({
      profileName: input.profileName,
      waId: input.waId,
      lastMessage: input.lastMessage,
      reason: input.reason,
      conversationId: input.conversation.id,
    }),
  );
}

async function generateBotReply(
  conversation: WhatsAppConversation,
  incomingText: string,
): Promise<{ text: string; requestHandoff: boolean }> {
  const brand = getMatuByteSummary();
  const knowledge = await buildKnowledgeContext();
  const history = await listMessages(conversation.id, 12);
  const priorBotReplies = history.filter(
    (m) => m.direction === 'outbound' && m.sender_type === 'bot',
  ).length;
  const isFirstBotReply = priorBotReplies === 0;

  const messages = [
    {
      role: 'system' as const,
      content: `Eres la primera recepción de WhatsApp de ${brand.company} (${brand.hq}).
NO eres un closer automático ni un chatbot de ventas agresivo.
Tu rol es corto y humano: saludar si hace falta, entender qué necesita en 1-2 preguntas, y cuando pidan propuesta, cotización, precios serios o hablar con alguien, pasar el chat a un asesor.

Tono:
- Español natural de Colombia, cercano, sin sonar a script.
- Máximo 2-3 líneas. Sin listas largas, sin emojis en exceso, sin "¡Estoy aquí para ayudarte!".
- Nunca inventes precios, plazos ni promesas.

Cuándo pasar a humano (OBLIGATORIO):
- Si pide propuesta, cotización, precio formal, reunirse, o hablar con una persona.
- Si el tema ya es comercial concreto (proyecto, presupuesto, alcance).
- En esos casos responde UNA frase corta y amable confirmando que un asesor le escribe, y al FINAL de tu mensaje escribe exactamente: [[HANDOFF]]

Si solo está explorando o saludando, responde breve y pregunta qué busca — sin cerrar la venta tú solo.

Saludo:
${
  isFirstBotReply
    ? '- Primer mensaje tuyo: saluda corto (ej. "Hola, ¿qué tal? Soy de MatuByte.") y pregunta en qué le puedes orientar.'
    : `- NO saludes de nuevo. Prohibido "¡Hola!", "Bienvenido", "Soy el asistente de MatuByte".
- Ve al grano.`
}

Knowledge MatuByte (solo referencia, no inventes datos):
${knowledge.slice(0, 5000)}`,
    },
    ...history.slice(-10).map((m) => ({
      role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: incomingText },
  ];

  const completion = await chatCompletion({
    temperature: 0.5,
    maxTokens: 280,
    messages,
  });

  let raw = completion.content.trim();
  const requestHandoff = /\[\[HANDOFF\]\]/i.test(raw);
  raw = raw.replace(/\s*\[\[HANDOFF\]\]\s*/gi, '').trim();
  const text = isFirstBotReply ? raw : stripRepeatedGreeting(raw);
  return { text, requestHandoff };
}

/** Quita saludos repetidos que el modelo insiste en anteponer. */
function stripRepeatedGreeting(text: string): string {
  const patterns = [
    /^¡?\s*hola[!¡.]?\s*👋?\s*/i,
    /^bienvenid[oa]s?\s+(a\s+)?matubyte[!.]?\s*/i,
    /^bienvenid[oa],?\s*soy el equipo de matubyte[!.]?\s*/i,
    /^soy el (asistente|equipo) de matubyte[^.!]*[.!]?\s*/i,
    /^¡?\s*hola[!¡.]?\s*👋?\s*bienvenid[oa][^.!\n]*[.!]?\s*/i,
  ];

  let out = text.trim();
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const re of patterns) {
      const next = out.replace(re, '').trim();
      if (next !== out && next.length > 0) {
        out = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

async function forceHumanSilence(
  conversation: WhatsAppConversation,
  reason: string,
): Promise<void> {
  if (conversation.mode !== 'human') {
    await setConversationMode(conversation.id, 'human');
  }
  pushLog({
    level: 'warn',
    agentId: AGENT_LABEL,
    message: `Silence/human lock · ${conversation.profile_name ?? conversation.wa_id}: ${reason}`,
  });
  sendAgentMessage({
    from: 'whatsapp-bot',
    to: 'broadcast',
    topic: 'whatsapp.human_pending',
    body: `Chat en silencio (humano): ${conversation.profile_name ?? conversation.wa_id} — ${reason}`,
    payload: { conversationId: conversation.id, reason },
  });
}

export async function handleIncomingWhatsAppMessage(input: {
  waId: string;
  profileName?: string | null;
  text: string;
  waMessageId?: string | null;
  messageType?: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const conversation = await getOrCreateConversation({
    waId: input.waId,
    profileName: input.profileName,
  });

  const messageType = input.messageType || 'text';
  const isMedia = ['audio', 'image', 'video', 'document', 'sticker'].includes(messageType);

  await saveMessage({
    conversationId: conversation.id,
    waMessageId: input.waMessageId,
    direction: 'inbound',
    senderType: 'customer',
    content: input.text,
    messageType,
    metadata: input.metadata,
  });

  void import('../services/automation-engine.js')
    .then(({ dispatchAutomationTrigger }) =>
      dispatchAutomationTrigger('whatsapp.message_received', {
        waId: input.waId,
        text: input.text,
        messageType,
        conversationId: conversation.id,
      }),
    )
    .catch(() => undefined);

  pushLog({
    level: 'info',
    agentId: AGENT_LABEL,
    message: `Inbound · ${input.profileName ?? input.waId}: ${isMedia ? `[${messageType}] ` : ''}${input.text.slice(0, 80)}`,
  });

  // 1) Modo humano: NUNCA responder — solo avisar para que respondas tú en /wa.html
  if (conversation.mode === 'human') {
    sendAgentMessage({
      from: 'whatsapp-bot',
      to: 'broadcast',
      topic: 'whatsapp.human_pending',
      body: `Nuevo mensaje en conversación humana: ${input.profileName ?? input.waId}`,
      payload: { conversationId: conversation.id },
    });

    if (
      !env.WHATSAPP_OWNER_PHONE ||
      input.waId.replace(/\D/g, '') !== env.WHATSAPP_OWNER_PHONE
    ) {
      await notifyOwnerWhatsApp(
        ownerAlertText({
          profileName: input.profileName,
          waId: input.waId,
          lastMessage: input.text,
          reason: isMedia
            ? `Nuevo ${messageType} (modo humano — responde tú)`
            : 'Nuevo mensaje (modo humano — responde tú)',
          conversationId: conversation.id,
        }),
      );
    }
    return;
  }

  // Media (audio/foto/video): pasar a humano — el bot no “escucha” ni inventa respuestas.
  if (isMedia) {
    await handoffToHuman({
      conversation,
      waId: input.waId,
      profileName: input.profileName,
      lastMessage: input.text,
      reason: `Cliente envió ${messageType}`,
      sendAckToCustomer: true,
      customAck:
        messageType === 'audio'
          ? 'Listo, recibí tu audio. Te lo pasa un asesor y te escribe por aquí.'
          : messageType === 'image'
            ? 'Listo, recibí tu foto. Un asesor la revisa y te escribe por aquí.'
            : 'Listo, recibí tu archivo. Un asesor lo revisa y te escribe por aquí.',
    });
    return;
  }

  // 2) Anti-loop: si el otro lado parece un bot / autorespuesta, callar y pasar a humano.
  if (looksLikeBotAutoresponse(input.text)) {
    await forceHumanSilence(conversation, 'posible bot/autorespuesta del otro lado');
    return;
  }

  const loopStreak = await countRecentBotLoop(conversation.id);
  if (loopStreak >= 4) {
    await forceHumanSilence(conversation, `bucle detectado (streak ${loopStreak})`);
    return;
  }

  // 3) Cliente pide asesor / propuesta / cotización → handoff manual + aviso a tu WhatsApp
  if (matchesHandoff(input.text)) {
    await handoffToHuman({
      conversation,
      waId: input.waId,
      profileName: input.profileName,
      lastMessage: input.text,
      reason: 'Cliente pidió asesor o propuesta',
      sendAckToCustomer: true,
    });
    return;
  }

  if (!(await isLlmConfigured())) {
    pushLog({
      level: 'error',
      agentId: AGENT_LABEL,
      message: 'LLM no configurado — no se puede responder automáticamente',
    });
    return;
  }

  try {
    const { text: reply, requestHandoff } = await generateBotReply(conversation, input.text);

    // El modelo decidió que ya toca un humano (propuesta/comercial).
    if (requestHandoff) {
      await handoffToHuman({
        conversation,
        waId: input.waId,
        profileName: input.profileName,
        lastMessage: input.text,
        reason: 'Listo para propuesta / asesor (bot pasó el chat)',
        sendAckToCustomer: true,
      });
      return;
    }

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
