import { expect, it, vi } from "vitest";
import { createHostedAboutAdapter } from "../createHostedAboutAdapter";
const sources = [
  {
    id: 1,
    kind: "vault" as const,
    label: "Synthetic",
    url: "https://example.org",
    revision: "a".repeat(64),
  },
];
it("returns deterministic content and read-only counter snapshots without network", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));
  try {
    const load = vi.fn(async () => sources);
    const adapter = createHostedAboutAdapter({}, load);
    expect(await adapter.synthesizeArtistDoc("artist")).toEqual({
      doc: "Synthetic Lore [1]",
      sources,
    });
    expect(await adapter.generateAboutFromDoc("Artist", "Lore", sources)).toBe(
      "Synthetic About [1]",
    );
    expect(await adapter.generateLoreSummary("artist")).toBeNull();
    expect(adapter.counters()).toEqual({ lore: 1, about: 1, summary: 1 });
    expect(Object.isFrozen(adapter.counters())).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    fetcher.mockRestore();
  }
});
it("never replaces an explicitly supplied manifest", async () => {
  const load = vi.fn(async () => sources);
  const adapter = createHostedAboutAdapter({}, load);
  expect((await adapter.synthesizeArtistDoc("artist", [])).sources).toEqual([]);
  expect(load).not.toHaveBeenCalled();
});
it.each(["lore", "about"] as const)(
  "injects %s failure only at the configured boundary",
  async stage => {
    const adapter = createHostedAboutAdapter({ [stage]: "fail" }, async () => sources);
    await expect(
      stage === "lore"
        ? adapter.synthesizeArtistDoc("artist")
        : adapter.generateAboutFromDoc("Artist", "Lore", sources),
    ).rejects.toThrow(`Synthetic ${stage} failure`);
    expect(adapter.counters()[stage]).toBe(1);
  },
);
it("aborts a held model boundary without timers or leftover work", async () => {
  const adapter = createHostedAboutAdapter({ about: "wait-for-abort" }, async () => sources);
  const controller = new AbortController();
  const pending = adapter.generateAboutFromDoc("Artist", "Lore", sources, {
    abortSignal: controller.signal,
  });
  const assertion = expect(pending).rejects.toThrow("test deadline");
  controller.abort(new Error("test deadline"));
  await assertion;
  expect(adapter.counters().about).toBe(1);
});
it("rejects an already aborted call before loading sources", async () => {
  const load = vi.fn(async () => sources);
  const adapter = createHostedAboutAdapter({}, load);
  await expect(
    adapter.synthesizeArtistDoc("artist", undefined, {
      abortSignal: AbortSignal.abort(new Error("cancelled")),
    }),
  ).rejects.toThrow("cancelled");
  expect(load).not.toHaveBeenCalled();
  expect(adapter.counters().lore).toBe(0);
});
