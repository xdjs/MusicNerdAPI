import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ lore: vi.fn(), jobs: vi.fn(), reopen: vi.fn(), social: vi.fn() }));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: m.lore }));
vi.mock("@/lib/research/getResearchJobs", () => ({ getResearchJobs: m.jobs }));
vi.mock("@/lib/research/reopenResearchJob", () => ({ reopenResearchJob: m.reopen }));
vi.mock("@/lib/research/queueSocialIngest", () => ({ queueSocialIngest: m.social }));
const { requestResearchRefresh } = await import("@/lib/research/requestResearchRefresh");

const LORE = "Rebuilding Lore from your current documents.";
const LORE_SKIPPED =
  "Lore is already queued or was checked recently. New document changes still trigger a rebuild.";
const job = (o: Record<string, unknown>) => ({
  id: "j",
  artistId: "a1",
  kind: "social_ingest",
  status: "done",
  cursor: 0,
  total: null,
  attempts: 0,
  state: {},
  updatedAt: null,
  activityId: null,
  ...o,
});

beforeEach(() => {
  vi.useRealTimers();
  Object.values(m).forEach(f => f.mockReset());
  m.lore.mockResolvedValue(true);
  m.jobs.mockResolvedValue([]);
  m.social.mockResolvedValue(true);
});

describe("requestResearchRefresh", () => {
  it("queues a manual Lore rebuild and a forced scrape after reopening finished jobs", async () => {
    expect(await requestResearchRefresh("a1", "c1")).toBe(
      `${LORE} Checking recent posts. Your bio will stay unchanged.`,
    );
    expect(m.lore).toHaveBeenCalledWith("a1", "c1", { manual: true });
    expect(m.reopen.mock.calls).toEqual([
      ["a1", "social_ingest"],
      ["a1", "caption_extract"],
    ]);
    expect(m.social).toHaveBeenCalledWith("a1", { force: true });
  });

  it("says when Update Latest is already checking Instagram", async () => {
    m.lore.mockResolvedValueOnce(false);
    m.jobs.mockResolvedValueOnce([
      job({
        kind: "latest_refresh",
        status: "running",
        state: { sources: { instagram: { status: "pending" } } },
      }),
    ]);
    expect(await requestResearchRefresh("a1", "c1")).toBe(
      `${LORE_SKIPPED} Update Latest is already checking Instagram. Let it finish before running social research.`,
    );
    expect(m.social).not.toHaveBeenCalled();
  });

  it("reports live social work with its progress", async () => {
    m.jobs.mockResolvedValueOnce([
      job({ kind: "caption_extract", status: "running", cursor: 3, total: 7 }),
    ]);
    expect(await requestResearchRefresh("a1", "c1")).toBe("Already reading your posts (3/7).");
    m.jobs.mockResolvedValueOnce([job({ status: "pending" })]);
    expect(await requestResearchRefresh("a1", "c1")).toBe(`${LORE} Already reading your posts.`);
    expect(m.social).not.toHaveBeenCalled();
  });

  it("holds the scrape for 30 minutes after the last one finished", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
    m.jobs.mockResolvedValueOnce([job({ updatedAt: "2026-09-29T11:50:30Z" })]);
    expect(await requestResearchRefresh("a1", "c1")).toBe(
      `${LORE} Social posts can be checked again in 21 minutes.`,
    );
    expect(m.social).not.toHaveBeenCalled();
  });

  it("says so when the scrape could not be queued", async () => {
    m.social.mockResolvedValueOnce(false);
    expect(await requestResearchRefresh("a1", "c1")).toBe(
      `${LORE} Social research could not start. Let any current Latest update finish, then try again.`,
    );
  });
});
