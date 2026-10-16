import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ResearchJob } from "@/lib/research/types";
import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";
import { runSpotifyMatch } from "../runSpotifyMatch";
const mocks = vi.hoisted(() => ({
  eligible: vi.fn(),
  save: vi.fn(),
  step: vi.fn(),
  attach: vi.fn(),
  cooldown: vi.fn(),
}));
vi.mock("../spotifyMatchEligible", () => ({ spotifyMatchEligible: mocks.eligible }));
vi.mock("../saveSpotifyMatchProgress", () => ({ saveSpotifyMatchProgress: mocks.save }));
vi.mock("../readSpotifyMatchStep", () => ({ readSpotifyMatchStep: mocks.step }));
vi.mock("../attachSpotifyMatch", () => ({ attachSpotifyMatch: mocks.attach }));
vi.mock("@/lib/spotify/checkSpotifyCooldown", () => ({ checkSpotifyCooldown: mocks.cooldown }));
const now = Date.parse("2026-10-15T12:00:00Z");
const state = {
  version: 1,
  purpose: "spotify_identity",
  deezerId: "1234",
  artistName: "The Ellis Court",
  creationActivityId: "11111111-1111-4111-8111-111111111111",
  directoryActivityId: "11111111-1111-4111-8111-111111111111",
  expiresAtMs: now + 86400000,
};
const job = (): ResearchJob => ({
  id: "job",
  artistId: "artist",
  kind: "spotify_match",
  status: "running",
  cursor: 0,
  total: null,
  attempts: 0,
  updatedAt: "2026-10-15T12:00:00Z",
  activityId: state.creationActivityId,
  state: { ...state },
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  mocks.eligible.mockResolvedValue(true);
  mocks.save.mockResolvedValue(true);
  mocks.cooldown.mockResolvedValue(undefined);
  mocks.attach.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());
describe("durable Spotify matching", () => {
  it("waits for a shared cooldown without provider calls or spending an attempt", async () => {
    const j = job();
    mocks.cooldown.mockRejectedValue(new SpotifyDeferredError(now + 14 * 3600000));
    expect(await runSpotifyMatch(j, now + 20000)).toMatchObject({ waiting: true, done: false });
    expect(mocks.step).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledWith(
      j,
      expect.objectContaining({ nextAttemptAtMs: now + 14 * 3600000 }),
      expect.objectContaining({ failure: false, status: "pending" }),
    );
  });
  it("preserves partial ISRC results on 429 and counts only the attempted request", async () => {
    const j = job();
    j.state = {
      ...j.state,
      phase: "spotify",
      isrcs: ["USAAA2600001", "USAAA2600002"],
      matches: [{ isrc: "USAAA2600001", artists: [] }],
    };
    mocks.step.mockRejectedValue(new SpotifyDeferredError(now + 50000000, true));
    await runSpotifyMatch(j, now + 20000);
    expect(mocks.save).toHaveBeenCalledWith(
      j,
      expect.objectContaining({ matches: j.state.matches, nextAttemptAtMs: now + 50000000 }),
      expect.objectContaining({ failure: true }),
    );
    expect(mocks.attach).not.toHaveBeenCalled();
  });
  it("checkpoints each completed step without resetting accumulated failures", async () => {
    const j = job();
    j.attempts = 2;
    mocks.step.mockResolvedValue({
      ...state,
      phase: "deezer",
      trackIds: ["11", "22"],
      trackCursor: 1,
      isrcs: ["USAAA2600001"],
    });
    await runSpotifyMatch(j, now + 20000);
    expect(mocks.save).toHaveBeenCalledWith(j, expect.objectContaining({ trackCursor: 1 }), {});
  });
  it("stops after four failed requests and after the job expiry", async () => {
    const j = job();
    j.attempts = 3;
    mocks.step.mockRejectedValue(new Error("network failure"));
    await runSpotifyMatch(j, now + 20000);
    expect(mocks.save).toHaveBeenLastCalledWith(
      j,
      expect.objectContaining({ outcome: "failed" }),
      expect.objectContaining({ status: "failed", failure: true }),
    );
    mocks.step.mockClear();
    j.state.expiresAtMs = now - 1;
    await runSpotifyMatch(j, now + 20000);
    expect(mocks.step).not.toHaveBeenCalled();
  });
  it("does not fetch or attach after identity changed or when a lease is stale", async () => {
    mocks.eligible.mockResolvedValue(false);
    await runSpotifyMatch(job(), now + 20000);
    expect(mocks.step).not.toHaveBeenCalled();
    expect(mocks.attach).not.toHaveBeenCalled();
  });
  it("attaches only completed unique evidence and leaves conflicts for review", async () => {
    const j = job();
    const artists = [{ id: "AAAAAAAAAAAAAAAAAAAAAA", name: state.artistName }];
    j.state = {
      ...j.state,
      phase: "spotify",
      isrcs: ["USAAA2600001", "USAAA2600002"],
      matches: [
        { isrc: "USAAA2600001", artists },
        { isrc: "USAAA2600002", artists },
      ],
    };
    expect(await runSpotifyMatch(j, now + 20000)).toMatchObject({ done: true });
    expect(mocks.attach).toHaveBeenCalledWith(j, j.state, artists[0].id);
    expect(mocks.step).not.toHaveBeenCalled();
    mocks.attach.mockResolvedValue(false);
    await runSpotifyMatch(j, now + 20000);
    expect(mocks.save).toHaveBeenLastCalledWith(
      j,
      expect.objectContaining({ outcome: "review_required" }),
      expect.objectContaining({ status: "done" }),
    );
  });
});
