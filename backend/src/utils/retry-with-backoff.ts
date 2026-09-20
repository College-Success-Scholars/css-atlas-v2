export interface RetryOptions {
  maxAttempts: number;
  retryDelayMs?: (error: unknown, attempt: number) => number | null;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<{ value: T; attempts: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return { value: await operation(), attempts: attempt };
    } catch (error) {
      lastError = error;
      const delayMs = options.retryDelayMs?.(error, attempt);
      if (attempt === options.maxAttempts || delayMs == null) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
