import { APIFY_CONTROL_TIMEOUT_MS } from "@/lib/instagram/const";

/** Reads only the token owner's username; no credential or profile data is retained. */
export async function getApifyAccountUsername(): Promise<string | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;
  try {
    const response = await fetch("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(APIFY_CONTROL_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { username?: unknown } };
    return typeof body.data?.username === "string" && body.data.username
      ? body.data.username
      : null;
  } catch {
    return null;
  }
}
