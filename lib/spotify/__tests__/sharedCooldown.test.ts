import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { checkSpotifyCooldown } from "../checkSpotifyCooldown";
import { recordSpotifyCooldown } from "../recordSpotifyCooldown";
import { fetchSpotifyResponse } from "../fetchSpotifyResponse";
import { SpotifyDeferredError } from "../SpotifyDeferredError";
import { spotifyCooldownKey } from "../spotifyCooldownKey";
const execute = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const now = Date.parse("2026-10-15T12:00:00Z");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("SPOTIFY_WEB_CLIENT_ID", "application-fixture");
  execute.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("shared Spotify request cooldown", () => {
  it("keys the application rather than access tokens or secrets", () => {
    const key = spotifyCooldownKey();
    vi.stubEnv("SPOTIFY_WEB_CLIENT_SECRET", "rotated");
    expect(spotifyCooldownKey()).toBe(key);
    expect(key).toMatch(/^spotify:[a-f0-9]{64}$/);
    expect(key).not.toContain("application-fixture");
  });
  it("does not fetch while another worker's cooldown remains active", async () => {
    execute.mockResolvedValue([{ retryAtMs: now + 3600000 }]);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(fetchSpotifyResponse("https://api.spotify.com/v1/search")).rejects.toMatchObject({
      retryAtMs: now + 3600000,
      requested: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends the request through a caller's transport instead of fetch", async () => {
    execute.mockResolvedValue([]);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const transport = vi.fn(async () => new Response("{}"));
    const res = await fetchSpotifyResponse(
      "https://api.spotify.com/v1/artists/a",
      { headers: { Authorization: "Bearer t" } },
      transport,
    );
    expect(res.status).toBe(200);
    expect(transport).toHaveBeenCalledWith(
      "https://api.spotify.com/v1/artists/a",
      expect.objectContaining({ headers: { Authorization: "Bearer t" } }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("records Retry-After on 429 and honors a longer concurrent cooldown", async () => {
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ retryAtMs: now + 50000000 }]);
    const fetch = vi.fn(
      async () => new Response("{}", { status: 429, headers: { "Retry-After": "120" } }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(fetchSpotifyResponse("https://api.spotify.com/v1/search")).rejects.toMatchObject({
      retryAtMs: now + 50000000,
      requested: true,
    });
    const { text, params } = renderSql(execute.mock.calls[1][0]);
    expect(text).toContain(
      "greatest(provider_request_cooldowns.blocked_until,excluded.blocked_until)",
    );
    expect(params).toContain(new Date(now + 120000).toISOString());
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("fails closed if storage cannot be read or written", async () => {
    execute.mockRejectedValue(new Error("store unavailable"));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(fetchSpotifyResponse("https://api.spotify.com/v1/search")).rejects.toThrow(
      "store unavailable",
    );
    expect(fetch).not.toHaveBeenCalled();
    await expect(recordSpotifyCooldown("60")).rejects.toThrow();
  });
  it("lets a request run after the durable deadline expires", async () => {
    execute.mockResolvedValue([]);
    await expect(checkSpotifyCooldown()).resolves.toBeUndefined();
    const response = new Response("{}");
    const fetch = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetch);
    expect(await fetchSpotifyResponse("https://api.spotify.com/v1/search")).toBe(response);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new SpotifyDeferredError(now).status).toBe(429);
  });
});
