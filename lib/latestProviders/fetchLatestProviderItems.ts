import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { latestProviderAccount } from "./latestProviderAccount";
import { normalizeLatestProviderItems } from "./normalizeLatestProviderItems";
import type { LatestProvider } from "./types";
/** Worker-only bounded provider read. One deadline covers headers and body; no arbitrary URLs. */
export async function fetchLatestProviderItems(provider: LatestProvider, accountId: string) {
  if (latestProviderAccount(provider, accountId) !== accountId)
    throw new Error("Invalid Latest account");
  const signal = AbortSignal.timeout(8000);
  let phase = provider === "spotify" ? "token" : "request";
  let status: number | null = null;
  try {
    const headers =
      provider === "spotify" ? (await getSpotifyHeaders()).headers : { accept: "application/json" };
    phase = "request";
    signal.throwIfAborted();
    const url =
      provider === "spotify"
        ? `https://api.spotify.com/v1/artists/${accountId}/albums?include_groups=album%2Csingle&limit=50&market=US`
        : provider === "deezer"
          ? `https://api.deezer.com/artist/${accountId}/albums?limit=50`
          : `https://api.inprocess.world/api/timeline?artist=${encodeURIComponent(accountId)}&limit=12`;
    const response = await fetch(url, { headers, signal, redirect: "error", cache: "no-store" });
    status = response.status;
    if (!response.ok)
      throw Object.assign(new Error("Latest provider unavailable"), { latestCode: "http_error" });
    phase = "body";
    if (!response.body)
      throw Object.assign(new Error("Latest provider body unavailable"), {
        latestCode: "invalid_payload",
      });
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 2_000_000)
          throw Object.assign(new Error("Latest provider body exceeds budget"), {
            latestCode: "body_too_large",
          });
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    phase = "parse";
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    phase = "normalize";
    return normalizeLatestProviderItems(provider, accountId, body);
  } catch (error) {
    const e = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
    const code =
      typeof e.latestCode === "string"
        ? e.latestCode
        : e.name === "TimeoutError" || e.name === "AbortError"
          ? "timeout"
          : phase === "parse" || phase === "normalize"
            ? "invalid_payload"
            : "network_error";
    throw Object.assign(
      new Error(
        code === "body_too_large"
          ? "Latest provider body exceeds budget"
          : "Latest provider failed",
      ),
      { latestPhase: phase, latestCode: code, status: status ?? e.status ?? null },
    );
  }
}
