import { describe, it, expect, vi, beforeEach } from "vitest";
import { URLMAP_BY_SITE } from "@/lib/discovery/__tests__/urlmapRows";

const { runHandleProbe } = vi.hoisted(() => ({ runHandleProbe: vi.fn() }));
vi.mock("@/lib/discovery/runHandleProbe", () => ({ runHandleProbe }));
const { tierThreeHandleProbeStream } = await import("@/lib/discovery/tierThreeHandleProbeStream");

const collect = async <T>(gen: AsyncGenerator<T>) => {
  const out: T[] = [];
  for await (const x of gen) out.push(x);
  return out;
};

beforeEach(() => {
  runHandleProbe.mockReset().mockResolvedValue(null);
});

describe("tierThreeHandleProbeStream", () => {
  it("never probes TikTok, yields a miss for every unresolved target", async () => {
    const out = await collect(
      tierThreeHandleProbeStream("Pete Rango", {}, new Set(["tiktok", "x"]), URLMAP_BY_SITE),
    );
    expect(out).toEqual([["x", null]]);
    expect(runHandleProbe.mock.calls.every(([p]) => p.platform === "x")).toBe(true);
  });

  it("propagates a confirmed handle to the platforms still missing", async () => {
    runHandleProbe.mockImplementation(async (p: { platform: string; handle: string }) =>
      p.platform === "youtube" && p.handle === "peterango"
        ? {
            url: "https://youtube.com/@peterango",
            preview: { imageUrl: null, title: "Pete Rango" },
          }
        : p.platform === "instagram" &&
            p.handle === "peterango" &&
            runHandleProbe.mock.calls.length > 8
          ? { url: "https://instagram.com/peterango", preview: { imageUrl: "i", title: null } }
          : null,
    );
    const out = await collect(
      tierThreeHandleProbeStream(
        "Pete Rango",
        {},
        new Set(["youtube", "instagram"]),
        URLMAP_BY_SITE,
      ),
    );
    expect(out.find(([p]) => p === "youtube")?.[1]).toMatchObject({ provisional: true });
    const seedInstagram = runHandleProbe.mock.calls.filter(([p]) => p.platform === "instagram");
    expect(seedInstagram.length).toBeGreaterThan(0);
  });
});
