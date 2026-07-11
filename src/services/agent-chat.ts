import {
  buildKnowledgeContext,
  getAgentDefinition,
  listChatMessages,
  saveChatMessage,
} from '../db/growth.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import { getAgentState } from '../runtime/state.js';

export async function chatWithAgent(input: {
  agentId: string;
  sessionId: string;
  message: string;
}): Promise<{ reply: string; sessionId: string }> {
  if (!isLlmConfigured() || /smoke|replace_me/i.test(process.env.LLM_API_KEY ?? '')) {
    throw new Error(
      'LLM_API_KEY no configurada. Pon tu API key real en .env (docs/CONFIGURACION.md).',
    );
  }

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

  const completion = await chatCompletion({
    temperature: 0.7,
    maxTokens: 900,
    messages: [
      {
        role: 'system',
        content: `${def.system_prompt ?? `Eres ${def.name} de MatuByte.`}

Rol: ${def.role}
Descripción: ${def.description}
Estado runtime: ${runtime?.status ?? 'unknown'} · task: ${runtime?.currentTask ?? 'n/a'}

Knowledge MatuByte (usa esto como verdad):
${knowledge.slice(0, 6500)}

Responde en español, breve y útil. Si te piden ejecutar algo, indica el endpoint POST /agents/${def.id}/run.`,
      },
      ...history.map((row) => ({
        role: row.role as 'user' | 'assistant' | 'system',
        content: row.content,
      })),
    ],
  });

  await saveChatMessage({
    agentId: input.agentId,
    sessionId: input.sessionId,
    role: 'assistant',
    content: completion.content,
  });

  return { reply: completion.content, sessionId: input.sessionId };
}
