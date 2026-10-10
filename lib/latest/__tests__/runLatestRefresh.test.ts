import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  instagram: vi.fn(),
  store: vi.fn(),
  provider: vi.fn(),
}));
vi.mock("@/lib/latest/authorizeLatestRefresh", () => ({ authorizeLatestRefresh: m.authorize }));
vi.mock("@/lib/latest/refreshLatestInstagram", () => ({ refreshLatestInstagram: m.instagram }));
vi.mock("@/lib/latest/latestRefreshStore", () => ({ latestRefreshStore: m.store }));
vi.mock("@/lib/latestProviders/refreshLatestProvider", () => ({
  refreshLatestProvider: m.provider,
}));
const { runLatestRefresh } = await import("@/lib/latest/runLatestRefresh");

const job = (instagram: string) => ({
  id: "job-1",
  artistId: "artist-1",
  kind: "latest_refresh" as const,
  status: "running" as const,
  cursor: 0,
  total: null,
  attempts: 0,
  updatedAt: null,
  activityId: "act-1",
  state: {
    claimId: "c1",
    userId: "u1",
    instagram: "handle",
    sources: {
      instagram: { status: instagram },
      inprocess: { status: "checked" },
      spotify: { status: "disconnected" },
      deezer: { status: "checked" },
      interviews: { status: "checked" },
    },
  },
});
const later = () => Date.now() + 55_000;

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset());
  m.authorize.mockResolvedValue(undefined);
  m.store.mockResolvedValue(undefined);
});

describe("runLatestRefresh", () => {
  it("re-checks the claim and identities before anything else", async () => {
    m.authorize.mockRejectedValueOnce(new Error("changed"));
    await expect(runLatestRefresh(job("pending"), later())).rejects.toThrow("changed");
    expect(m.instagram).not.toHaveBeenCalled();
  });

  it("keeps waiting while the Instagram check is still running", async () => {
    m.instagram.mockResolvedValueOnce({ status: "pending" });
    expect(await runLatestRefresh(job("pending"), later())).toEqual({
      done: false,
      waiting: true,
      progress: "Checking Instagram",
    });
    expect(m.store.mock.calls[0][2]).toBe(false);
  });

  it("finishes when Instagram is checked", async () => {
    m.instagram.mockResolvedValueOnce({ status: "checked", checkedAt: "t" });
    const j = job("pending");
    expect(await runLatestRefresh(j, later())).toMatchObject({
      done: true,
      progress: "Latest check finished",
    });
    expect(m.store).toHaveBeenCalledWith(
      j,
      expect.objectContaining({
        sources: expect.objectContaining({ instagram: { status: "checked", checkedAt: "t" } }),
      }),
      true,
      false,
    );
  });

  it("finishes at once when Instagram needs no check", async () => {
    expect(await runLatestRefresh(job("disconnected"), later())).toMatchObject({ done: true });
    expect(m.instagram).not.toHaveBeenCalled();
  });

  it("leaves Instagram for the next slice when too little time is left", async () => {
    expect(await runLatestRefresh(job("pending"), Date.now() + 20_000)).toMatchObject({
      done: false,
    });
    expect(m.instagram).not.toHaveBeenCalled();
  });
});

it("resets successful polling only when handing the lease back, without leaking its flag", async () => {
  const j = job("pending");
  m.instagram.mockResolvedValueOnce({ status: "pending", resetAttempts: true });
  await runLatestRefresh(j, later());
  expect(m.store).toHaveBeenCalledWith(j, expect.any(Object), false, true);
  expect(j.state.sources.instagram).toEqual({ status: "pending" });
});

it("refreshes pending durable providers even when Instagram is disconnected", async () => {
  const j = job("disconnected");
  j.state.sources.inprocess = { status: "pending" };
  m.provider.mockResolvedValue({ status: "checked", checkedAt: "2026-10-09T00:00:00Z" });
  expect(await runLatestRefresh(j, later())).toMatchObject({ done: true });
  expect(m.provider).toHaveBeenCalledWith(j, "inprocess");
});
it("processes one bounded provider per slice and keeps remaining providers queued", async () => {
  const j = job("disconnected");
  j.state.sources.inprocess = { status: "pending" };
  j.state.sources.deezer = { status: "pending" };
  m.provider.mockResolvedValue({ status: "checked" });
  expect(await runLatestRefresh(j, later())).toMatchObject({ done: false, waiting: true });
  expect(m.provider).toHaveBeenCalledTimes(1);
});

it("does not checkpoint an expired provider lease over a newer worker", async () => {
  const j = job("disconnected");
  j.state.sources.inprocess = { status: "pending" };
  m.provider.mockResolvedValue({ status: "pending", stale: true });
  expect(await runLatestRefresh(j, later())).toMatchObject({ done: false, waiting: true });
  expect(m.store).not.toHaveBeenCalled();
});
