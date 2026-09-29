/**
 * Normalizes typed or pasted input to a public http(s) URL, adding https:// to
 * a bare domain. It doesn't make a URL safe to fetch: callers still apply the
 * safe-fetch and ownership checks.
 *
 * @param input - The input.
 * @returns The URL, or null for anything that isn't a public http(s) URL with a valid hostname and no credentials.
 */
export function normalizePublicUrl(input: string): string | null {
  const value = input.trim();
  if (value.startsWith("/") || !value || /[\s\\]/.test(value)) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  if (!/^https?:\/\/[^/]/i.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const labels = url.hostname.split(".");
    if (labels.length < 2 || labels.some(label => !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)))
      return null;
    return candidate;
  } catch {
    return null;
  }
}
