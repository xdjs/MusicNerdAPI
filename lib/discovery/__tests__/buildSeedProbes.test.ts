import { describe, it, expect } from "vitest";
import { buildSeedProbes } from "@/lib/discovery/buildSeedProbes";

describe("buildSeedProbes", () => {
  it("probes existing handles (platform order) as confirmed and name slugs as guesses, deduped", () => {
    expect(
      buildSeedProbes("Pete Rango", { twitch: "@p3t3rango", x: "p3t3rango", instagram: "" }),
    ).toEqual([
      { handle: "p3t3rango", source: "existing x handle", confirmed: true },
      { handle: "peterango", source: "derived from artist name", confirmed: false },
      { handle: "pete-rango", source: "derived from artist name", confirmed: false },
      { handle: "pete.rango", source: "derived from artist name", confirmed: false },
      { handle: "pete_rango", source: "derived from artist name", confirmed: false },
    ]);
  });
});
