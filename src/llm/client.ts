import { env } from '../config/env.js';
import {
  loadBootstrapConfig,
  tryLoadCurrentProjectConfig,
} from '../tenancy/project-config.js';

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

interface LlmCredentials {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
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

function isMiniMaxProvider(provider: string): boolean {
  return provider === 'minimax';
}

function cleanAssistantContent(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

async function resolveLlmCredentials(): Promise<LlmCredentials | null> {
  const projectCfg = await tryLoadCurrentProjectConfig().catch(() => null);
  if (projectCfg) {
    const { llm } = projectCfg;
    if (llm.configured && llm.apiKey && llm.baseUrl && llm.model) {
      return {
        apiKey: llm.apiKey,
        baseUrl: llm.baseUrl,
        model: llm.model,
        provider: llm.provider,
      };
    }
    return null;
  }

  const bootstrap = loadBootstrapConfig();
  if (bootstrap.llm.configured && bootstrap.llm.apiKey && bootstrap.llm.baseUrl && bootstrap.llm.model) {
    return {
      apiKey: bootstrap.llm.apiKey,
      baseUrl: bootstrap.llm.baseUrl,
      model: bootstrap.llm.model,
      provider: bootstrap.llm.provider,
    };
  }
  return null;
}

export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  let content = '';
  let model = options.model ?? '';
  for await (const chunk of streamChatCompletion(options)) {
    if (chunk.type === 'token') {
      content += chunk.text;
    } else if (chunk.type === 'done') {
      content = chunk.content;
      model = chunk.model;
    }
  }
  if (!content) {
    throw new Error('LLM API returned an empty completion');
  }
  return { content, model, raw: null };
}

export async function* streamChatCompletion(
  options: ChatCompletionOptions,
): AsyncGenerator<
  { type: 'token'; text: string } | { type: 'done'; content: string; model: string }
> {
  const creds = await resolveLlmCredentials();
  if (!creds) {
    throw new Error(
      'LLM no configurado. Define llm_api_key, llm_model y llm_base_url en la configuración del proyecto.',
    );
  }

  const url = resolveChatCompletionsUrl(creds.baseUrl);
  const model = options.model ?? creds.model;

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? (isMiniMaxProvider(creds.provider) ? 1 : 0.7),
    stream: true,
  };

  if (options.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens;
    if (isMiniMaxProvider(creds.provider)) {
      body.max_completion_tokens = options.maxTokens;
    }
  }

  if (isMiniMaxProvider(creds.provider) && /MiniMax-M3/i.test(model)) {
    body.thinking = { type: 'disabled' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } | string }
      | null;
    const errorMessage =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error?.message ?? response.statusText;
    throw new Error(`LLM API error (${response.status}): ${errorMessage}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('LLM API no devolvió stream');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          yield { type: 'token', text: delta };
        }
      } catch {
        // Ignorar líneas SSE mal formadas.
      }
    }
  }

  const content = cleanAssistantContent(full);
  if (!content) {
    throw new Error('LLM API returned an empty completion');
  }

  yield { type: 'done', content, model };
}

export async function isLlmConfigured(): Promise<boolean> {
  const creds = await resolveLlmCredentials();
  if (!creds) return false;
  return !/smoke|replace_me|changeme|xxx/i.test(creds.apiKey);
}

/** @deprecated Use isLlmConfigured() async — kept for health checks without tenant */
export function isLlmConfiguredSync(): boolean {
  return Boolean(env.LLM_API_KEY && env.LLM_BASE_URL && env.LLM_MODEL);
}
