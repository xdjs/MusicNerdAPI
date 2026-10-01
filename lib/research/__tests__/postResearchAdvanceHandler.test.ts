import { describe, it, expect, vi, beforeEach } from "vitest";

const advance = vi.fn();
vi.mock("@/lib/research/advanceResearch", () => ({
  advanceResearch: (...a: unknown[]) => advance(...a),
}));
const { postResearchAdvanceHandler } = await import("@/lib/research/postResearchAdvanceHandler");

const id = "50f23458-df64-4381-8042-7333e8b64531";
const post = (body: unknown) =>
  new Request("http://x/api/research/advance", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => advance.mockReset());

describe("postResearchAdvanceHandler", () => {
  it("runs one slice for the artist with the route's whole budget", async () => {
    advance.mockResolvedValue({ ran: true, jobId: "j", progress: "scrape started (r)" });
    const response = await postResearchAdvanceHandler(post({ artistId: id }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      ran: true,
      jobId: "j",
      progress: "scrape started (r)",
    });
    expect(advance).toHaveBeenCalledWith({ budgetMs: 56_000, artistId: id });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("passes the kinds a caller asks for, e.g. Update Latest's own pump", async () => {
    advance.mockResolvedValue({ ran: false });
    const id = "50f23458-df64-4381-8042-7333e8b64531";
    await postResearchAdvanceHandler(post({ artistId: id, kinds: ["latest_refresh"] }));
    expect(advance).toHaveBeenCalledWith({
      budgetMs: 56_000,
      artistId: id,
      kinds: ["latest_refresh"],
    });
  });

  it("answers 200 with ran: false on an error, so callers do not back off from healthy work", async () => {
    advance.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    const response = await postResearchAdvanceHandler(post({}));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "error", error: "advance failed", ran: false });
  });

  it("rejects a malformed artist id before claiming anything", async () => {
    const response = await postResearchAdvanceHandler(post({ artistId: "abc" }));
    expect(response.status).toBe(400);
    expect(advance).not.toHaveBeenCalled();
  });
});
