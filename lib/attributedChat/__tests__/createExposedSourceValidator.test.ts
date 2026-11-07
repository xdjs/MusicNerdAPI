import { describe, expect, it, vi } from "vitest";
import { createExposedSourceValidator } from "../createExposedSourceValidator";
import type { ResearchOriginal } from "../../questionResearch/types";

const source = (sourceId = "arbitrary:one"): ResearchOriginal => ({
  sourceId,
  revision: "r1",
  text: "Complete original text, including the final qualification.",
  url: "https://example.test/source",
  curation: "approved",
  evidenceKind: "original_text",
  speaker: "not_applicable",
  publishedAt: null,
  retrievedAt: "2026-11-06",
  truncated: false,
});
const setup = (initialSources = [source()]) => {
  const loadCurrent = vi.fn(async () => structuredClone(initialSources));
  const assertLegacy = vi.fn(async (_source: ResearchOriginal) => {});
  return {
    initialSources,
    loadCurrent,
    assertLegacy,
    validator: createExposedSourceValidator({
      initialSources,
      loadCurrent,
      assertLegacy,
    }),
  };
};
describe("fresh public exposure validation for every source prefix", () => {
  it("does not load or run legacy checks for an empty batch", async () => {
    const { validator, loadCurrent, assertLegacy } = setup();
    await validator.validate([]);
    expect(loadCurrent).not.toHaveBeenCalled();
    expect(assertLegacy).not.toHaveBeenCalled();
  });
  it.each([
    "arbitrary:one",
    "social:one",
    "latest:one",
    "provider:one",
    "vault:one",
    "discovery:one",
  ])("rejects removed %s before legacy checks", async id => {
    const s = source(id);
    const { validator, loadCurrent, assertLegacy } = setup([s]);
    loadCurrent.mockResolvedValue([]);
    await expect(validator.validate([s])).rejects.toThrow("no longer public");
    expect(assertLegacy).not.toHaveBeenCalled();
  });
  it.each([
    ["revision", "r2"],
    ["text", "Complete original text"],
    ["url", "https://different.test"],
    ["curation", "pending"],
    ["evidenceKind", "caption"],
    ["speaker", "unverified"],
    ["publishedAt", "2025-01-01"],
    ["retrievedAt", "2026-11-07"],
    ["truncated", true],
    ["activityDate", "2020"],
    ["activityDateKind", "release"],
    ["futurePolicy", { publication: "private" }],
  ])("rejects changed %s even with otherwise identical revision", async (key, value) => {
    const s = source();
    const { validator, loadCurrent, assertLegacy } = setup([s]);
    loadCurrent.mockResolvedValue([{ ...s, [key]: value }]);
    await expect(validator.validate([s])).rejects.toThrow();
    expect(assertLegacy).not.toHaveBeenCalled();
  });
  it("fresh-loads once for the entire batch and validates it before legacy checks", async () => {
    const sources = [source("custom:a"), source("custom:b")];
    const { validator, loadCurrent, assertLegacy } = setup(sources);
    await validator.validate(sources);
    expect(loadCurrent).toHaveBeenCalledTimes(1);
    expect(assertLegacy).toHaveBeenCalledTimes(2);
    loadCurrent.mockResolvedValue([sources[0], { ...sources[1], text: "changed" }]);
    assertLegacy.mockClear();
    await expect(validator.validate(sources)).rejects.toThrow();
    expect(loadCurrent).toHaveBeenCalledTimes(2);
    expect(assertLegacy).not.toHaveBeenCalled();
  });
  it("rejects ambiguous initial, fresh and selected IDs", async () => {
    const s = source();
    expect(() => setup([s, s])).toThrow("Ambiguous");
    const { validator, loadCurrent } = setup([s]);
    await expect(validator.validate([s, s])).rejects.toThrow("Ambiguous");
    loadCurrent.mockResolvedValue([s, s]);
    await expect(validator.validate([s])).rejects.toThrow("Ambiguous");
  });
  it("rejects unknown and caller-modified originals even if the current corpus contains them", async () => {
    const s = source();
    const { validator, loadCurrent } = setup([s]);
    const unknown = source("custom:new");
    loadCurrent.mockResolvedValue([s, unknown]);
    await expect(validator.validate([unknown])).rejects.toThrow();
    await expect(validator.validate([{ ...s, text: "caller replacement" }])).rejects.toThrow();
  });
  it("propagates loader and legacy denial without fallback", async () => {
    const s = source();
    const { validator, loadCurrent, assertLegacy } = setup([s]);
    loadCurrent.mockRejectedValueOnce(new Error("loader denied"));
    await expect(validator.validate([s])).rejects.toThrow("loader denied");
    expect(assertLegacy).not.toHaveBeenCalled();
    assertLegacy.mockRejectedValueOnce(new Error("legacy denied"));
    await expect(validator.validate([s])).rejects.toThrow("legacy denied");
  });
  it("does not mutate caller data or allow legacy guards to mutate retained snapshots", async () => {
    const s = source();
    const frozen = Object.freeze({ ...s });
    const { validator, loadCurrent, assertLegacy } = setup([frozen]);
    assertLegacy.mockImplementation(async copy => {
      copy.text = "mutated guard copy";
    });
    await validator.validate([frozen]);
    await validator.validate([frozen]);
    expect(frozen).toEqual(s);
    expect(loadCurrent).toHaveBeenCalledTimes(2);
  });
  it("retains initial snapshots despite later mutation of the supplied corpus", async () => {
    const s = source();
    const expected = structuredClone(s);
    const { validator, loadCurrent } = setup([s]);
    s.text = "caller mutated initial";
    loadCurrent.mockResolvedValue([expected]);
    await expect(validator.validate([expected])).resolves.toBeUndefined();
    await expect(validator.validate([s])).rejects.toThrow();
  });
  it("snapshots the selected batch before awaiting the fresh read", async () => {
    const s = source();
    const expected = structuredClone(s);
    const { validator, loadCurrent } = setup([s]);
    let release!: (value: ResearchOriginal[]) => void;
    loadCurrent.mockImplementation(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    const pending = validator.validate([s]);
    s.text = "mutation while loading";
    release([expected]);
    await expect(pending).resolves.toBeUndefined();
  });
});
