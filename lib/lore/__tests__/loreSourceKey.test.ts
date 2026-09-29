import { describe, it, expect } from "vitest";
import { loreSourceKey } from "@/lib/lore/loreSourceKey";

const sources = [
  { id: "document", title: "Studio journal", type: "document" },
  { id: "audio", title: "Conversation", type: "audio" },
];

describe("loreSourceKey", () => {
  it("is the same for the same inventory in any order", () => {
    expect(loreSourceKey([...sources].reverse())).toBe(loreSourceKey(sources));
  });

  it("changes on removal, rename, reclassification or a new source", () => {
    const key = loreSourceKey(sources);
    for (const changed of [
      sources.slice(1),
      [{ ...sources[0], title: "Revised" }, sources[1]],
      [{ ...sources[0], type: "article" }, sources[1]],
      [...sources, { id: "new" }],
    ]) {
      expect(loreSourceKey(changed)).not.toBe(key);
    }
  });

  it("reads a missing title as empty and a missing type as article", () => {
    expect(loreSourceKey([{ id: "a" }])).toBe(JSON.stringify([["a", "", "article"]]));
  });
});
