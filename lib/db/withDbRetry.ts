/**
 * Retries a database read on a transient error (connect timeout, reset,
 * unreachable host), with backoff.
 *
 * @param operation - The read.
 * @param retries - How many more attempts to make.
 * @param delayMs - The wait before the next attempt; doubles each time.
 * @returns The operation's result; rethrows any other error, or the last transient one.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  retries: number = 2,
  delayMs: number = 300,
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    const failure = error as { message?: string; code?: string; errno?: string } | undefined;
    const message = String(failure?.message ?? failure ?? "");
    const code = failure?.code ?? failure?.errno;
    const isTransient =
      code === "CONNECT_TIMEOUT" ||
      /ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH|Connection terminated unexpectedly/i.test(
        message,
      );
    if (retries > 0 && isTransient) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return withDbRetry(operation, retries - 1, delayMs * 2);
    }
    throw error;
  }
}
