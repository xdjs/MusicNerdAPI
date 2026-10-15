import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpotifyMatchState } from "../types";
import { readSpotifyMatchStep } from "../readSpotifyMatchStep";
import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";
const mocks = vi.hoisted(() => ({ headers: vi.fn(), spotify: vi.fn() }));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders: mocks.headers }));
vi.mock("@/lib/spotify/fetchSpotifyResponse", () => ({ fetchSpotifyResponse: mocks.spotify }));
const state: SpotifyMatchState = {
  version: 1,
  purpose: "spotify_identity",
  deezerId: "1234",
  artistName: "The Ellis Court",
  creationActivityId: "11111111-1111-4111-8111-111111111111",
  directoryActivityId: "11111111-1111-4111-8111-111111111111",
  expiresAtMs: Date.now() + 86400000,
};
const artist = { id: "AAAAAAAAAAAAAAAAAAAAAA", name: state.artistName };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue({ headers: { Authorization: "Bearer fixture" } });
});
afterEach(() => vi.unstubAllGlobals());
describe("bounded catalog matching reads", () => {
  it("checkpoints unique track IDs and collects one unique recording per completed detail read", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [{ id: 11 }, { id: 11 }, { id: 22 }] }))
      .mockResolvedValueOnce(Response.json({ id: 11, isrc: "usaaa2600001" }))
      .mockResolvedValueOnce(Response.json({ id: 22, isrc: "USAAA2600001" }));
    vi.stubGlobal("fetch", fetch);
    const top = await readSpotifyMatchStep(state, Date.now() + 20000);
    expect(top.trackIds).toEqual(["11", "22"]);
    const first = await readSpotifyMatchStep(top, Date.now() + 20000);
    expect(first.trackCursor).toBe(1);
    const second = await readSpotifyMatchStep(first, Date.now() + 20000);
    expect(second.isrcs).toEqual(["USAAA2600001"]);
    expect(second.phase).toBe("spotify");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("rejects a malformed or wrong Deezer detail instead of silently completing its checkpoint", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({ id: 22, isrc: "USAAA2600001" }));
    vi.stubGlobal("fetch", fetch);
    const pending = { ...state, phase: "deezer" as const, trackIds: ["11"], trackCursor: 0 };
    await expect(readSpotifyMatchStep(pending, Date.now() + 20000)).rejects.toThrow();
    await expect(readSpotifyMatchStep(pending, Date.now() + 20000)).rejects.toThrow();
  });
  it("resumes only the next ISRC, rejects unrelated recordings and deduplicates credits", async () => {
    const previous = { isrc: "USAAA2600001", artists: [artist] };
    mocks.spotify.mockResolvedValue(
      Response.json({
        tracks: {
          items: [
            { external_ids: { isrc: "USAAA2600002" }, artists: [artist, artist] },
            {
              external_ids: { isrc: "USAAA2600999" },
              artists: [{ id: "BBBBBBBBBBBBBBBBBBBBBB", name: "Other" }],
            },
          ],
        },
      }),
    );
    const next = await readSpotifyMatchStep(
      { ...state, phase: "spotify", isrcs: [previous.isrc, "USAAA2600002"], matches: [previous] },
      Date.now() + 20000,
    );
    expect(mocks.spotify).toHaveBeenCalledTimes(1);
    expect(mocks.spotify.mock.calls[0][0]).toContain("USAAA2600002");
    expect(mocks.spotify.mock.calls[0][0]).toContain("market=US");
    expect(next.matches).toEqual([previous, { isrc: "USAAA2600002", artists: [artist] }]);
  });
  it("propagates a 429 and does not mark the recording complete", async () => {
    const pending = { ...state, phase: "spotify" as const, isrcs: ["USAAA2600001"], matches: [] };
    const error = new SpotifyDeferredError(Date.now() + 3600000, true);
    mocks.spotify.mockRejectedValue(error);
    await expect(readSpotifyMatchStep(pending, Date.now() + 20000)).rejects.toBe(error);
    expect(pending.matches).toEqual([]);
    expect(mocks.spotify).toHaveBeenCalledTimes(1);
  });
  it("marks incomplete search results for review instead of choosing from truncated evidence", async () => {
    mocks.spotify.mockResolvedValue(
      Response.json({
        tracks: {
          total: 11,
          items: [{ external_ids: { isrc: "USAAA2600001" }, artists: [artist] }],
        },
      }),
    );
    const next = await readSpotifyMatchStep(
      { ...state, phase: "spotify", isrcs: ["USAAA2600001"] },
      Date.now() + 20000,
    );
    expect(next.matches?.[0]).toMatchObject({ incomplete: true });
  });
});
