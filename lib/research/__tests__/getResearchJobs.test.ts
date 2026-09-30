import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getResearchJobs } = await import("@/lib/research/getResearchJobs");

beforeEach(() => execute.mockReset());

describe("getResearchJobs", () => {
  it("reads every job for the artist and maps the rows", async () => {
    execute.mockResolvedValueOnce([
      {
        id: "j1",
        artist_id: "a1",
        kind: "social_ingest",
        status: "done",
        cursor: 0,
        total: null,
        attempts: 0,
        state: {},
        updated_at: "2026-09-29T00:00:00Z",
        activity_id: "e1",
      },
    ]);
    const jobs = await getResearchJobs("a1");
    expect(jobs).toEqual([
      {
        id: "j1",
        artistId: "a1",
        kind: "social_ingest",
        status: "done",
        cursor: 0,
        total: null,
        attempts: 0,
        state: {},
        updatedAt: "2026-09-29T00:00:00Z",
        activityId: "e1",
      },
    ]);
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toBe("select * from artist_research_jobs where artist_id = $1::uuid");
    expect(params).toEqual(["a1"]);
  });

  it("is empty on a database error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getResearchJobs("a1")).toEqual([]);
    error.mockRestore();
  });
});
