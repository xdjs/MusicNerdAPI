import { describe, it, expect } from "vitest";
import { probeCandidate } from "@/lib/discovery/probeCandidate";

describe("probeCandidate", () => {
  it("makes a tier-3 candidate, provisional only for a name-derived guess", () => {
    const hit = {
      url: "https://youtube.com/@peterango",
      preview: { imageUrl: null, title: "Pete Rango" },
    };
    expect(
      probeCandidate(
        {
          platform: "youtube",
          handle: "peterango",
          source: "derived from artist name",
          confirmed: false,
        },
        hit,
        "Pete Rango",
        "derived from artist name",
      ),
    ).toEqual({
      tier: 3,
      provisional: true,
      platform: "youtube",
      url: "https://youtube.com/@peterango",
      reasoning:
        'Handle probe: og:title matched "Pete Rango" for @peterango (derived from artist name)',
      preview: hit.preview,
    });
    expect(
      probeCandidate(
        { platform: "x", handle: "p", source: "propagated", confirmed: true },
        { url: "u", preview: { imageUrl: "i", title: null } },
        "Pete Rango",
        "propagated from a handle confirmed on another platform",
      ),
    ).toMatchObject({
      provisional: false,
      reasoning:
        "Handle probe: og:image resolved for @p (propagated from a handle confirmed on another platform)",
    });
  });
});
