import { beforeEach, expect, it, vi } from "vitest";
import type { TransactionDb } from "@/lib/ownership/types";
import { MAX_KNOWLEDGE_CHARS, MAX_KNOWLEDGE_ROWS } from "@/lib/knowledge/types";
import { loadPrivateResearchUrlKeys } from "../loadPrivateResearchUrlKeys";
const execute = vi.fn();
const tx = { execute } as unknown as TransactionDb;
beforeEach(() => execute.mockReset());
it("uses persistence's host/path/tracking identity without collapsing editions or path case", async () => {
  execute.mockResolvedValue([
    { url: "https://www.example.com/Story/?edition=1&utm_source=old#part" },
    { url: "https://twitter.com/Artist/status/AbC?t=old" },
  ]);
  const keys = await loadPrivateResearchUrlKeys(tx, "artist");
  expect(keys.has("https://example.com/Story?edition=1")).toBe(true);
  expect(keys.has("https://example.com/Story?edition=2")).toBe(false);
  expect(keys.has("https://example.com/story?edition=1")).toBe(false);
  expect(keys.has("https://x.com/Artist/status/AbC")).toBe(true);
  expect(execute).toHaveBeenCalledTimes(1);
});
it("fails closed on excessive, malformed or clipped private metadata", async () => {
  for (const rows of [
    Array.from({ length: MAX_KNOWLEDGE_ROWS + 1 }, () => ({ url: "https://example.com/a" })),
    [{ url: null }],
    [{ url: "x".repeat(2049) }],
    Array.from({ length: Math.ceil(MAX_KNOWLEDGE_CHARS / 2000) + 1 }, () => ({
      url: "x".repeat(2000),
    })),
  ]) {
    execute.mockResolvedValue(rows);
    await expect(loadPrivateResearchUrlKeys(tx, "artist")).rejects.toMatchObject({
      code: "corpus_too_large",
      status: 413,
    });
  }
});
it("retains the existing raw-key fallback for an invalid legacy vault URL", async () => {
  execute.mockResolvedValue([{ url: "legacy-invalid-url" }]);
  expect(await loadPrivateResearchUrlKeys(tx, "artist")).toEqual(new Set(["legacy-invalid-url"]));
});
