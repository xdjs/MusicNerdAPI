import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SPOTIFY_WEB_CLIENT_ID", "id");
  vi.stubEnv("SPOTIFY_WEB_CLIENT_SECRET", "secret");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getSpotifyHeaders", () => {
  it("fetches a client-credentials token and returns bearer headers", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 })),
    );
    expect(await getSpotifyHeaders()).toEqual({ headers: { Authorization: "Bearer tok" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://accounts.spotify.com/api/token");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toBe(
      "grant_type=client_credentials&client_id=id&client_secret=secret",
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws when the credentials are not configured", async () => {
    vi.stubEnv("SPOTIFY_WEB_CLIENT_SECRET", "");
    await expect(getSpotifyHeaders()).rejects.toThrow("Spotify credentials not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when Spotify returns no token", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_client" }), { status: 400 }),
    );
    await expect(getSpotifyHeaders()).rejects.toThrow("Failed to get Spotify access token");
  });
});
