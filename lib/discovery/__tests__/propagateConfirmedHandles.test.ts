import { describe, it, expect, vi, beforeEach } from "vitest";
import { URLMAP_BY_SITE } from "@/lib/discovery/__tests__/urlmapRows";

const { runHandleProbe } = vi.hoisted(() => ({ runHandleProbe: vi.fn() }));
vi.mock("@/lib/discovery/runHandleProbe", () => ({ runHandleProbe }));
const { propagateConfirmedHandles } = await import("@/lib/discovery/propagateConfirmedHandles");

beforeEach(() => {
  runHandleProbe.mockReset();
});

describe("propagateConfirmedHandles", () => {
  it("probes each confirmed handle on each target (never TikTok) and yields the first hit per platform", async () => {
    runHandleProbe.mockImplementation(async (p: { platform: string }) =>
      p.platform === "youtube"
        ? { url: "https://youtube.com/@p3t3rango", preview: { imageUrl: "i", title: null } }
        : null,
    );
    const out = [];
    for await (const x of propagateConfirmedHandles(
      new Set(["p3t3rango"]),
      ["youtube", "tiktok", "x"],
      URLMAP_BY_SITE,
      "Pete Rango",
    ))
      out.push(x);
    expect(out).toEqual([
      [
        "youtube",
        {
          tier: 3,
          provisional: false,
          platform: "youtube",
          url: "https://youtube.com/@p3t3rango",
          reasoning:
            "Handle probe: og:image resolved for @p3t3rango (propagated from a handle confirmed via web search)",
          preview: { imageUrl: "i", title: null },
        },
      ],
    ]);
    expect(runHandleProbe.mock.calls.map(([p]) => p.platform).sort()).toEqual(["x", "youtube"]);
    expect(runHandleProbe.mock.calls[0][0]).toMatchObject({ confirmed: true });
  });
});
