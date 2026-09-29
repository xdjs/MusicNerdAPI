import { describe, it, expect, vi, afterEach } from "vitest";
import { requestMusicBrainz } from "@/lib/musicbrainz/requestMusicBrainz";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

describe("requestMusicBrainz", () => {
  it("sends the contact user agent and returns the JSON object", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ artists: [] }) });
    expect(await requestMusicBrainz("/artist?query=x")).toEqual({
      status: "ok",
      data: { artists: [] },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://musicbrainz.org/ws/2/artist?query=x");
    expect(init.headers).toEqual({
      Accept: "application/json",
      "User-Agent": "MusicNerd/1.0 (https://musicnerd.xyz)",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("tells a 404 from other failures", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await requestMusicBrainz("/a")).toEqual({ status: "not-found" });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    expect(await requestMusicBrainz("/a")).toEqual({ status: "unavailable" });
  });

  it("is unavailable for malformed JSON, a non-object body or a network error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError("bad");
      },
    });
    expect(await requestMusicBrainz("/a")).toEqual({ status: "unavailable" });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [1] });
    expect(await requestMusicBrainz("/a")).toEqual({ status: "unavailable" });
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    expect(await requestMusicBrainz("/a")).toEqual({ status: "unavailable" });
  });
});
