/**
 * Reintenta operaciones susceptibles a fallos transitorios de red
 * ("fetch failed", timeouts, DNS). No reintenta errores de negocio/HTTP 4xx.
 */
export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  label?: string;
  onRetry?: (attempt: number, err: unknown) => void;
}

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    message.includes('socket hang up') ||
    message.includes('network')
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 800;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt === attempts;
      if (isLastAttempt || !isTransientNetworkError(err)) {
        throw err;
      }

      options.onRetry?.(attempt, err);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}
