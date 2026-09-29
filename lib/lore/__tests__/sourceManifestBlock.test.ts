import { describe, it, expect } from "vitest";
import { sourceManifestBlock } from "@/lib/lore/sourceManifestBlock";

describe("sourceManifestBlock", () => {
  it("is empty with no sources", () => {
    expect(sourceManifestBlock([])).toBe("");
  });

  it("numbers each kind of source the way the prompt cites it", () => {
    expect(
      sourceManifestBlock([
        { id: 1, kind: "vault", label: "Review", url: "https://r.example" },
        { id: 2, kind: "interview", label: 'Their own words — "Sound?"', url: null },
        {
          id: 3,
          kind: "social",
          label: "Instagram collaboration with @x",
          url: "https://i.example",
        },
      ]),
    ).toBe(
      "\n--- NUMBERED SOURCES (cite these ids as [n]) ---\n" +
        '[1] APPROVED SOURCE — "Review" (https://r.example)\n' +
        '[2] INTERVIEW — Their own words — "Sound?"\n' +
        "[3] SOCIAL SIGNAL — Instagram collaboration with @x (https://i.example)\n" +
        "--- END SOURCES ---",
    );
  });
});
