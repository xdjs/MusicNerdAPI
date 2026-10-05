import { describe, it, expect, vi } from "vitest";

const { runIngest, runCaptionExtract, runLoreRefresh, runSourceSearchJob, runLatestRefresh } =
  vi.hoisted(() => ({
    runLatestRefresh: vi.fn(async () => ({ progress: "latest", done: true })),
    runSourceSearchJob: vi.fn(async () => ({ progress: "sources", done: true })),
    runIngest: vi.fn(async () => ({ progress: "ingest", done: true })),
    runCaptionExtract: vi.fn(async () => ({ progress: "captions", done: false })),
    runLoreRefresh: vi.fn(async () => ({ progress: "lore", done: true })),
  }));
vi.mock("@/lib/research/runIngest", () => ({ runIngest }));
vi.mock("@/lib/research/runCaptionExtract", () => ({ runCaptionExtract }));
vi.mock("@/lib/research/runLoreRefresh", () => ({ runLoreRefresh }));
vi.mock("@/lib/research/runSourceSearchJob", () => ({ runSourceSearchJob }));
vi.mock("@/lib/latest/runLatestRefresh", () => ({ runLatestRefresh }));
const runSourceExtraction = vi.fn(async () => ({ progress: "extraction", done: true }));
vi.mock("@/lib/sourceExtraction/runSourceExtraction", () => ({
  runSourceExtraction: () => runSourceExtraction(),
}));
const { runResearchJob } = await import("@/lib/research/runResearchJob");

const job = (kind: string) =>
  ({
    id: "j",
    artistId: "a",
    kind,
    status: "running",
    cursor: 0,
    total: null,
    attempts: 0,
    state: {},
    updatedAt: null,
  }) as never;

describe("runResearchJob", () => {
  it("dispatches durable source extraction", async () => {
    expect(await runResearchJob(job("source_extract"), 123)).toEqual({
      progress: "extraction",
      done: true,
    });
  });
  it("runs each kind with its own runner and the caller's deadline", async () => {
    expect(await runResearchJob(job("social_ingest"), 123)).toEqual({
      progress: "ingest",
      done: true,
    });
    expect(runIngest).toHaveBeenCalledWith(expect.objectContaining({ kind: "social_ingest" }), 123);
    expect(await runResearchJob(job("caption_extract"), 456)).toEqual({
      progress: "captions",
      done: false,
    });
    expect(runCaptionExtract).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "caption_extract" }),
      456,
    );
    expect(await runResearchJob(job("lore_refresh"), 789)).toEqual({
      progress: "lore",
      done: true,
    });
    expect(runLoreRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "lore_refresh" }),
      789,
    );
  });

  it("runs Update Latest's Instagram check with its own runner", async () => {
    expect(await runResearchJob(job("latest_refresh"), 654)).toEqual({
      progress: "latest",
      done: true,
    });
    expect(runLatestRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "latest_refresh" }),
      654,
    );
  });

  it("runs a source search with its own runner", async () => {
    expect(await runResearchJob(job("source_search"), 321)).toEqual({
      progress: "sources",
      done: true,
    });
    expect(runSourceSearchJob).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "source_search" }),
      321,
    );
  });
});
