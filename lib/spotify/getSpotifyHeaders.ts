import type { SpotifyHeaders } from "@/lib/spotify/types";

/**
 * Spotify client-credentials headers. Fetched fresh on every call: the only
 * caller is a Lore rebuild, which makes one catalog request, so a cache would
 * save nothing.
 *
 * @returns Bearer headers for the Spotify Web API.
 */
export async function getSpotifyHeaders(): Promise<SpotifyHeaders> {
  const clientId = process.env.SPOTIFY_WEB_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_WEB_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw Object.assign(new Error("Spotify credentials not configured"), {
      latestCode: "missing_credentials",
    });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(2_000),
  });
  if (!res.ok)
    throw Object.assign(new Error("Failed to get Spotify access token"), {
      latestCode: "http_error",
      status: res.status,
    });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!data.access_token)
    throw Object.assign(new Error("Failed to get Spotify access token"), {
      latestCode: "invalid_payload",
      status: res.status,
    });
  return { headers: { Authorization: `Bearer ${data.access_token}` } };
}
