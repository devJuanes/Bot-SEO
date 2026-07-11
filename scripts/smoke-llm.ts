import { chatCompletion } from '../src/llm/client.js';
import { env } from '../src/config/env.js';

async function main(): Promise<void> {
  console.log('Testing LLM', {
    baseUrl: env.LLM_BASE_URL,
    model: env.LLM_MODEL,
    keyPrefix: env.LLM_API_KEY.slice(0, 8) + '…',
  });

  const result = await chatCompletion({
    temperature: 0.2,
    maxTokens: 80,
    messages: [
      { role: 'system', content: 'Responde en una sola frase corta.' },
      { role: 'user', content: 'Di solo: MatuByte Z.AI OK' },
    ],
  });

  console.log('OK', { model: result.model, content: result.content });
}

main().catch((err) => {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
