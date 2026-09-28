import { describe, it, expect, vi, beforeEach } from "vitest";

const advance = vi.fn();
vi.mock("@/lib/research/advanceResearch", () => ({
  advanceResearch: (...a: unknown[]) => advance(...a),
}));
const { getResearchAdvanceHandler } = await import("@/lib/research/getResearchAdvanceHandler");

const get = async (headers: Record<string, string> = {}) =>
  getResearchAdvanceHandler(new Request("http://x/api/research/advance", { headers }));

beforeEach(() => {
  advance.mockReset();
  vi.stubEnv("CRON_SECRET", "");
});

describe("getResearchAdvanceHandler", () => {
  it("keeps taking slices while there is budget", async () => {
    advance
      .mockResolvedValueOnce({
        ran: true,
        jobId: "a",
        progress: "Stored posts and thumbnails through 9",
      })
      .mockResolvedValueOnce({ ran: true, jobId: "b", progress: "ingested 12 post(s)" })
      .mockResolvedValue({ ran: false });
    const body = await (await get()).json();
    expect(body).toMatchObject({ status: "ok", ran: true });
    expect(body.slices).toHaveLength(2);
    expect(advance).toHaveBeenCalledTimes(3);
  });

  it("stops the moment the queue is empty, and names no artist", async () => {
    advance.mockResolvedValue({ ran: false });
    expect(await (await get()).json()).toEqual({ status: "ok", ran: false, slices: [] });
    expect(advance).toHaveBeenCalledTimes(1);
    expect(advance.mock.calls[0][0].artistId).toBeUndefined();
    expect(advance.mock.calls[0][0].budgetMs).toBeGreaterThan(0);
  });

  it("requires the secret once one is configured", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    advance.mockResolvedValue({ ran: false });
    const denied = await get();
    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ status: "error", error: "unauthorized", ran: false });
    expect(advance).not.toHaveBeenCalled();
    expect((await get({ authorization: "Bearer s3cret" })).status).toBe(200);
    expect(advance).toHaveBeenCalled();
  });

  it("keeps the slices it finished when a later one throws", async () => {
    advance
      .mockResolvedValueOnce({ ran: true, jobId: "a", progress: "x" })
      .mockImplementationOnce(async () => {
        throw new Error("apify exploded");
      });
    const body = await (await get()).json();
    expect(body).toMatchObject({ status: "error", error: "advance failed", ran: true });
    expect(body.slices).toHaveLength(1);
  });

  it("sets a waiting job aside for the rest of the tick", async () => {
    advance
      .mockResolvedValueOnce({
        ran: true,
        jobId: "ingest-1",
        waiting: true,
        progress: "scrape still running",
      })
      .mockResolvedValueOnce({
        ran: true,
        jobId: "ingest-2",
        progress: "Stored posts and thumbnails through 9",
      })
      .mockResolvedValue({ ran: false });
    await get();
    expect(advance.mock.calls[0][0].excludeJobIds).toEqual([]);
    expect(advance.mock.calls[1][0].excludeJobIds).toEqual(["ingest-1"]);
    expect(advance.mock.calls[2][0].excludeJobIds).toEqual(["ingest-1"]);
  });
});
