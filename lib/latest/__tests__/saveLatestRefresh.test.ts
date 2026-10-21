import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LatestRefreshState } from "@/lib/latest/types";

const m = vi.hoisted(() => ({ execute: vi.fn(), find: vi.fn(), activity: vi.fn() }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({
  withScopedArtistWrite: async (_artistId: string, fn: (tx: unknown) => unknown) =>
    fn({ execute: m.execute }),
}));
vi.mock("@/lib/latest/findLatestRefreshId", () => ({ findLatestRefreshId: m.find }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.activity }));
const { saveLatestRefresh } = await import("@/lib/latest/saveLatestRefresh");

const artistRow = { instagram: "ig", inprocess: null, spotify: "sp", deezer: null };
const state = (instagram: LatestRefreshState["sources"]["instagram"]["status"] = "pending") =>
  ({
    claimId: "c1",
    userId: "u1",
    instagram: "ig",
    inprocess: "",
    spotify: "sp",
    deezer: "",
    sources: {
      instagram: { status: instagram },
      inprocess: { status: "disconnected" },
      spotify: { status: "checked" },
      deezer: { status: "disconnected" },
      interviews: { status: "checked" },
    },
  }) satisfies LatestRefreshState;
const insertSql = () => JSON.stringify(m.execute.mock.calls.at(-1)![0]);

beforeEach(() => {
  m.execute.mockReset();
  m.find.mockReset().mockResolvedValue(null);
  m.activity.mockReset().mockResolvedValue("act-1");
});

describe("saveLatestRefresh", () => {
  it("returns a request that queued first", async () => {
    m.find.mockResolvedValueOnce("job-0");
    expect(await saveLatestRefresh("a1", state())).toBe("job-0");
    expect(m.execute).not.toHaveBeenCalled();
  });

  it("returns null when a connection changed during the checks", async () => {
    m.execute.mockResolvedValueOnce([{ ...artistRow, instagram: "renamed" }]);
    expect(await saveLatestRefresh("a1", state())).toBeNull();
    expect(m.execute).toHaveBeenCalledTimes(1);
    expect(m.activity).not.toHaveBeenCalled();
  });

  it("queues the Instagram check as pending, attributed to a latest_refresh activity", async () => {
    m.execute
      .mockResolvedValueOnce([artistRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "job-1" }]);
    expect(await saveLatestRefresh("a1", state())).toBe("job-1");
    expect(insertSql()).toContain("pending");
    expect(insertSql()).toContain("act-1");
    expect(m.activity).toHaveBeenCalledWith("a1", "latest_refresh", {}, { execute: m.execute });
  });

  it("saves the request as done when Instagram has nothing to check", async () => {
    m.execute
      .mockResolvedValueOnce([artistRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "job-2" }]);
    await saveLatestRefresh("a1", state("disconnected"));
    expect(insertSql()).toContain("done");
  });

  it("leaves Instagram to research that already owns it", async () => {
    m.execute
      .mockResolvedValueOnce([artistRow])
      .mockResolvedValueOnce([{ id: "ingest" }])
      .mockResolvedValueOnce([{ id: "job-3" }]);
    const s = state();
    await saveLatestRefresh("a1", s);
    expect(s.sources.instagram).toEqual({ status: "failed" });
    expect(insertSql()).toContain("done");
  });

  it("fails loudly when the insert returns nothing", async () => {
    m.execute
      .mockResolvedValueOnce([artistRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await expect(saveLatestRefresh("a1", state())).rejects.toThrow("Latest request was not saved");
  });
});
