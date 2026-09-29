/**
 * `fetch` with a hard timeout. Never throws: a network error, an abort or any
 * other failure resolves to null, so a slow or hostile host can't take down
 * the caller.
 *
 * @param url - The URL.
 * @param init - The request, without a signal.
 * @param timeoutMs - When to give up.
 * @returns The response, or null when the request did not complete.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
