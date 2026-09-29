import { describe, it, expect } from "vitest";
import { applyVerdicts } from "@/lib/relevance/applyVerdicts";

const judged = [
  { url: "https://a.example", title: null, text: "a" },
  { url: "https://b.example", title: null, text: "b" },
];
const fresh = () =>
  new Map([
    ["https://a.example", "undecided" as const],
    ["https://b.example", "undecided" as const],
  ]);

describe("applyVerdicts", () => {
  it("binds verdicts by index into the batch that was sent", () => {
    const v = fresh();
    applyVerdicts(
      [
        { i: 0, v: "no" },
        { i: 1, v: "About" },
      ],
      judged,
      v,
    );
    expect(v.get("https://a.example")).toBe("not-about-artist");
    expect(v.get("https://b.example")).toBe("about-artist");
  });

  it("ignores URLs, out-of-range or non-integer indexes, unknown verdicts and junk rows", () => {
    const v = fresh();
    applyVerdicts(
      [
        { url: "https://invented.example", v: "about" } as never,
        { i: 7, v: "no" },
        { i: 0.5, v: "no" },
        { i: 1, v: "maybe" },
        null as never,
      ],
      judged,
      v,
    );
    expect([...v.values()]).toEqual(["undecided", "undecided"]);
    expect(v.has("https://invented.example")).toBe(false);
  });

  it("maps lists to lists-artist", () => {
    const v = fresh();
    applyVerdicts([{ i: 0, v: "lists" }], judged, v);
    expect(v.get("https://a.example")).toBe("lists-artist");
  });
});
