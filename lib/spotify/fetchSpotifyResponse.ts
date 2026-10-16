import { checkSpotifyCooldown } from "./checkSpotifyCooldown";
import { recordSpotifyCooldown } from "./recordSpotifyCooldown";
import { SpotifyDeferredError } from "./SpotifyDeferredError";

/** One bounded Spotify request, coordinated with every API/Web request using the same app. */
export async function fetchSpotifyResponse(url: string, init: RequestInit = {}): Promise<Response> {
  const target = new URL(url);
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.port ||
    !["api.spotify.com", "accounts.spotify.com"].includes(target.hostname)
  )
    throw new Error("Invalid Spotify endpoint");
  await checkSpotifyCooldown();
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (response.status === 429) {
    const retryAfter = response.headers?.get("Retry-After") ?? null;
    await response.body?.cancel().catch(() => undefined);
    const until = await recordSpotifyCooldown(retryAfter);
    throw new SpotifyDeferredError(until, true);
  }
  return response;
}
