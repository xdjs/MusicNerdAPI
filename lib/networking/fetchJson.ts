/**
 * One JSON GET with a hard timeout. Never throws: a non-2xx status, a network
 * error, an abort or an unparseable body all resolve to null.
 *
 * @param url - The URL.
 * @param opts - Request options.
 * @param opts.headers - Request headers.
 * @param opts.timeoutMs - When to give up.
 * @returns The parsed body, or null.
 */
export async function fetchJson(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs: number },
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: opts.headers,
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
