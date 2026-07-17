import { env } from '../config/env.js';
import { withRetry } from '../utils/retry.js';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  raw: unknown;
}

function resolveChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');

  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }

  if (normalized.endsWith('/v1')) {
    return `${normalized}/chat/completions`;
  }

  return `${normalized}/v1/chat/completions`;
}

function isMiniMax(): boolean {
  return env.LLM_PROVIDER === 'minimax';
}

function cleanAssistantContent(raw: string): string {
  // MiniMax may wrap internal reasoning in <think>...</think>
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const url = resolveChatCompletionsUrl(env.LLM_BASE_URL);
  const model = options.model ?? env.LLM_MODEL;

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? (isMiniMax() ? 1 : 0.7),
  };

  if (options.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens;
    // MiniMax prefers max_completion_tokens for new integrations
    if (isMiniMax()) {
      body.max_completion_tokens = options.maxTokens;
    }
  }

  // Faster/cleaner agent replies: skip thinking chain for MiniMax-M3
  if (isMiniMax() && /MiniMax-M3/i.test(model)) {
    body.thinking = { type: 'disabled' };
  }

  const response = await withRetry(
    () =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.LLM_API_KEY}`,
        },
        body: JSON.stringify(body),
      }),
    { attempts: 3, delayMs: 1000, label: 'llm-fetch' },
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string } | string;
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: ChatCompletionResult['usage'];
      }
    | null;

  if (!response.ok) {
    const errorMessage =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error?.message ?? response.statusText;
    throw new Error(`LLM API error (${response.status}): ${errorMessage}`);
  }

  const rawContent = payload?.choices?.[0]?.message?.content?.trim() ?? '';
  const content = cleanAssistantContent(rawContent);
  if (!content) {
    throw new Error('LLM API returned an empty completion');
  }

  return {
    content,
    model: payload?.model ?? model,
    usage: payload?.usage,
    raw: payload,
  };
}

export function isLlmConfigured(): boolean {
  return Boolean(env.LLM_API_KEY && env.LLM_BASE_URL && env.LLM_MODEL);
}
