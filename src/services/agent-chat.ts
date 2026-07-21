import {
  buildKnowledgeContext,
  getAgentDefinition,
  listChatMessages,
  saveChatMessage,
} from '../db/growth.js';
import { isLlmConfigured, streamChatCompletion } from '../llm/client.js';
import { getAgentState } from '../runtime/state.js';

async function buildAgentMessages(input: {
  agentId: string;
  sessionId: string;
  message: string;
}) {
  const def = await getAgentDefinition(input.agentId);
  if (!def || !def.is_chat_enabled) {
    throw new Error(`Agent chat no disponible para ${input.agentId}`);
  }

  await saveChatMessage({
    agentId: input.agentId,
    sessionId: input.sessionId,
    role: 'user',
    content: input.message,
  });

  const history = await listChatMessages(input.agentId, input.sessionId, 20);
  const knowledge = await buildKnowledgeContext();
  const runtime = getAgentState(input.agentId as never);

  const messages = [
    {
      role: 'system' as const,
      content: `${def.system_prompt ?? `Eres ${def.name} de MatuByte.`}

Rol: ${def.role}
Descripción: ${def.description}
Estado runtime: ${runtime?.status ?? 'unknown'} · tarea: ${runtime?.currentTask ?? 'n/a'}

Knowledge de marca (usa esto como verdad):
${knowledge.slice(0, 6500)}

Responde en español, claro y útil. El agente trabaja en segundo plano de forma automática; si está pausado, indícalo.`,
    },
    ...history.map((row) => ({
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
    })),
  ];

  return { def, messages };
}

export async function chatWithAgent(input: {
  agentId: string;
  sessionId: string;
  message: string;
}): Promise<{ reply: string; sessionId: string }> {
  if (!(await isLlmConfigured())) {
    throw new Error(
      'LLM no configurado. Configura el proveedor y API key en Ajustes del proyecto.',
    );
  }

  const { messages } = await buildAgentMessages(input);
  let reply = '';

  for await (const chunk of streamChatCompletion({
    temperature: 0.7,
    maxTokens: 900,
    messages,
  })) {
    if (chunk.type === 'done') {
      reply = chunk.content;
    } else {
      reply += chunk.text;
    }
  }

  await saveChatMessage({
    agentId: input.agentId,
    sessionId: input.sessionId,
    role: 'assistant',
    content: reply,
  });

  return { reply, sessionId: input.sessionId };
}

export async function* streamChatWithAgent(input: {
  agentId: string;
  sessionId: string;
  message: string;
}): AsyncGenerator<
  | { type: 'thinking' }
  | { type: 'token'; text: string }
  | { type: 'done'; reply: string; sessionId: string }
> {
  if (!(await isLlmConfigured())) {
    throw new Error(
      'LLM no configurado. Configura el proveedor y API key en Ajustes del proyecto.',
    );
  }

  const { messages } = await buildAgentMessages(input);
  yield { type: 'thinking' };

  let reply = '';
  for await (const chunk of streamChatCompletion({
    temperature: 0.7,
    maxTokens: 900,
    messages,
  })) {
    if (chunk.type === 'token') {
      reply += chunk.text;
      yield { type: 'token', text: chunk.text };
    } else {
      reply = chunk.content;
    }
  }

  await saveChatMessage({
    agentId: input.agentId,
    sessionId: input.sessionId,
    role: 'assistant',
    content: reply,
  });

  yield { type: 'done', reply, sessionId: input.sessionId };
}

function customChatAgentId(customId: string): string {
  return `custom:${customId}`;
}

async function buildCustomAgentMessages(input: {
  projectId: string;
  customId: string;
  sessionId: string;
  message: string;
}) {
  const { getCustomAgent } = await import('../db/custom-agents.js');
  const { getProjectSetting } = await import('../tenancy/store.js');

  const projectId = input.projectId;

  const agent = await getCustomAgent(projectId, input.customId);
  if (!agent) throw new Error('Agente personalizado no encontrado');

  const chatId = customChatAgentId(input.customId);
  await saveChatMessage({
    agentId: chatId,
    sessionId: input.sessionId,
    role: 'user',
    content: input.message,
  });

  const history = await listChatMessages(chatId, input.sessionId, 20);
  const knowledge = await buildKnowledgeContext();
  const brandName = (await getProjectSetting<string>(projectId, 'brand_name')) ?? '';

  const system =
    agent.system_prompt?.trim() ||
    `Eres un agente de growth personalizado para ${brandName || 'la empresa'}.`;

  const messages = [
    {
      role: 'system' as const,
      content: `${system}

Objetivo: ${agent.goal}
Horario: ${agent.schedule_hint || 'automático mientras esté activo'}
Estado: ${agent.is_enabled ? 'en ejecución' : 'pausado'}

Knowledge de marca:
${knowledge.slice(0, 5500)}

Responde en español, claro y accionable.`,
    },
    ...history.map((row) => ({
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
    })),
  ];

  return { chatId, messages };
}

export async function* streamChatWithCustomAgent(input: {
  projectId: string;
  customId: string;
  sessionId: string;
  message: string;
}): AsyncGenerator<
  | { type: 'thinking' }
  | { type: 'token'; text: string }
  | { type: 'done'; reply: string; sessionId: string }
> {
  if (!(await isLlmConfigured())) {
    throw new Error(
      'LLM no configurado. Configura el proveedor y API key en Ajustes del proyecto.',
    );
  }

  const { chatId, messages } = await buildCustomAgentMessages(input);
  yield { type: 'thinking' };

  let reply = '';
  for await (const chunk of streamChatCompletion({
    temperature: 0.7,
    maxTokens: 900,
    messages,
  })) {
    if (chunk.type === 'token') {
      reply += chunk.text;
      yield { type: 'token', text: chunk.text };
    } else {
      reply = chunk.content;
    }
  }

  await saveChatMessage({
    agentId: chatId,
    sessionId: input.sessionId,
    role: 'assistant',
    content: reply,
  });

  yield { type: 'done', reply, sessionId: input.sessionId };
}
