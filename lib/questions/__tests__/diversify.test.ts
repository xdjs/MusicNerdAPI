import { describe, it, expect } from "vitest";
import { diversify } from "@/lib/questions/diversify";

describe("diversify", () => {
  it("spreads across kinds instead of returning several of the strongest", () => {
    const items = [
      { kind: "partnership", id: 1 },
      { kind: "partnership", id: 2 },
      { kind: "partnership", id: 3 },
      { kind: "statement", id: 4 },
      { kind: "music", id: 5 },
    ];
    expect(diversify(items, 3).map(x => x.kind)).toEqual(["partnership", "statement", "music"]);
  });

  it("keeps the model ranking within a kind and still fills a one-kind set", () => {
    expect(
      diversify(
        [
          { kind: "credit", id: 1 },
          { kind: "credit", id: 2 },
        ],
        2,
      ).map(x => x.id),
    ).toEqual([1, 2]);
    expect(diversify([{ kind: "credit" }, { kind: "credit" }, { kind: "credit" }], 3)).toHaveLength(
      3,
    );
  });

  it("never returns more than asked for", () => {
    expect(diversify([{ kind: "a" }, { kind: "b" }, { kind: "c" }], 2)).toHaveLength(2);
  });
});
