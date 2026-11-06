import { it, expect, vi } from "vitest";
import { createAttributionRegistry } from "../createAttributionRegistry";

it("batch resolve checks all selected originals once per boundary with independent copies", async () => {
  const legacy = vi.fn(async () => {});
  const batch = vi.fn(async (originals: any[]) => {
    for (const original of originals) original.text = "mutated callback input";
  });
  const registry = createAttributionRegistry({
    artistId: "a",
    turnId: "t",
    assertCurrent: legacy,
    assertCurrentBatch: batch,
  });
  const ids = [0, 1, 2].map(i => {
    const original = {
      sourceId: `s:${i}`,
      revision: "r",
      text: `Exact original ${i}`,
      url: `https://example.test/${i}`,
    };
    return registry.registerTextRead(original, {
      ...original,
      n: i + 1,
      title: `Title ${i}`,
    }).blocks[0].id;
  });
  const signal = new AbortController().signal;
  const first = await registry.resolve(ids, signal);
  await registry.resolve(ids, signal);
  expect(batch).toHaveBeenCalledTimes(2);
  expect(batch.mock.calls.every(call => call[0].length === 3)).toBe(true);
  expect(legacy).not.toHaveBeenCalled();
  expect(first[0].text).toBe("Exact original 0");
});
it("batch resolve retains cancellation during an unresolved batch check", async () => {
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  const batch = vi.fn(() => gate);
  const controller = new AbortController();
  const registry = createAttributionRegistry({
    artistId: "a",
    turnId: "t",
    assertCurrent: async () => {},
    assertCurrentBatch: batch,
  });
  const original = {
    sourceId: "s",
    revision: "r",
    text: "Exact original",
    url: "https://example.test",
  };
  const id = registry.registerTextRead(original, {
    ...original,
    n: 1,
    title: "Title",
  }).blocks[0].id;
  const pending = registry.resolve([id], controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow();
  release();
  expect(batch).toHaveBeenCalledTimes(1);
});
