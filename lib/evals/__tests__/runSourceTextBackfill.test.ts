import { beforeEach, expect, it, vi } from "vitest";

const { execute, fetchSourceText } = vi.hoisted(() => ({
  execute: vi.fn(),
  fetchSourceText: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
vi.mock("@/lib/sourceExtraction/fetchSourceText", () => ({ fetchSourceText }));
const { runSourceTextBackfill } = await import("@/lib/evals/runSourceTextBackfill");

const fetched = (status: string, extra: object = {}) => ({
  status,
  capturedAt: "2026-11-15T00:00:00.000Z",
  httpStatus: 200,
  truncated: false,
  ...extra,
});

beforeEach(() => {
  execute.mockReset();
  fetchSourceText.mockReset();
});

it("saves the text of readable pages and reports the rest by host and status only", async () => {
  execute
    .mockResolvedValueOnce([
      { id: "a", url: "https://www.example.com/artist/secret-path" },
      { id: "b", url: "https://blocked.example/page" },
      { id: "c", url: "https://empty.example/x" },
    ])
    .mockResolvedValueOnce([{ id: "a" }]);
  fetchSourceText
    .mockResolvedValueOnce(fetched("ready", { text: "twelve chars" }))
    .mockResolvedValueOnce(fetched("blocked", { httpStatus: 403 }))
    .mockResolvedValueOnce(fetched("empty"));
  const result = await runSourceTextBackfill("artist");
  expect(result).toEqual({
    missing: 3,
    saved: 1,
    savedChars: 12,
    outcomes: { ready: 1, blocked: 1, empty: 1 },
    failures: ["blocked.example=blocked:403", "empty.example=empty:200"],
  });
  expect(execute).toHaveBeenCalledTimes(2);
});

it("counts a page as skipped when the row changed before the save, and a thrown fetch as an error", async () => {
  execute
    .mockResolvedValueOnce([
      { id: "a", url: "https://one.example/a" },
      { id: "b", url: "not a url" },
    ])
    .mockResolvedValueOnce([]);
  fetchSourceText
    .mockResolvedValueOnce(fetched("ready", { text: "text" }))
    .mockRejectedValueOnce(new Error("https://one.example/a?token=secret"));
  const result = await runSourceTextBackfill("artist");
  expect(result).toEqual({
    missing: 2,
    saved: 0,
    savedChars: 0,
    outcomes: { skipped: 1, error: 1 },
    failures: ["one.example=skipped:200", "invalid-url=error"],
  });
});

it("does nothing when every approved link already has text", async () => {
  execute.mockResolvedValueOnce([]);
  expect(await runSourceTextBackfill("artist")).toEqual({
    missing: 0,
    saved: 0,
    savedChars: 0,
    outcomes: {},
    failures: [],
  });
  expect(fetchSourceText).not.toHaveBeenCalled();
});
