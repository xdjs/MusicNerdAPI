import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { latestProviderAccount } from "./latestProviderAccount";
import { normalizeLatestProviderItems } from "./normalizeLatestProviderItems";
import type { LatestProvider } from "./types";
/** Worker-only bounded provider read. One deadline covers headers and body; no arbitrary URLs. */
export async function fetchLatestProviderItems(provider: LatestProvider, accountId: string) {
  if (latestProviderAccount(provider, accountId) !== accountId)
    throw new Error("Invalid Latest account");
  const signal = AbortSignal.timeout(8000);
  const headers =
    provider === "spotify" ? (await getSpotifyHeaders()).headers : { accept: "application/json" };
  signal.throwIfAborted();
  const url =
    provider === "spotify"
      ? `https://api.spotify.com/v1/artists/${accountId}/albums?include_groups=album%2Csingle&limit=50&market=US`
      : provider === "deezer"
        ? `https://api.deezer.com/artist/${accountId}/albums?limit=50`
        : `https://api.inprocess.world/api/timeline?artist=${encodeURIComponent(accountId)}&limit=12`;
  const response = await fetch(url, { headers, signal, redirect: "error", cache: "no-store" });
  if (!response.ok || !response.body) throw new Error("Latest provider unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) throw new Error("Latest provider body exceeds budget");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return normalizeLatestProviderItems(
    provider,
    accountId,
    JSON.parse(Buffer.concat(chunks).toString("utf8")),
  );
}
