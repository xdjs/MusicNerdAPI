import { describe, it, expect, vi } from "vitest";

const { extractArtistId } = vi.hoisted(() => ({ extractArtistId: vi.fn() }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId }));
vi.mock("@/lib/sources/stripQuery", () => ({ stripQuery: (u: string) => u.split("?")[0] }));
const { resolveOutboundHandles } = await import("@/lib/vault/resolveOutboundHandles");

describe("resolveOutboundHandles", () => {
  it("resolves each link once, query stripped, handles normalized, unresolved ones dropped", async () => {
    extractArtistId.mockImplementation(async (u: string) =>
      u.includes("instagram")
        ? { siteName: "instagram", id: "@Dupesdidit", cardPlatformName: null }
        : null,
    );
    expect(
      await resolveOutboundHandles([
        "https://instagram.com/dupesdidit?igsh=1",
        "https://example.com",
      ]),
    ).toEqual([{ siteName: "instagram", id: "dupesdidit" }]);
    expect(extractArtistId).toHaveBeenCalledWith("https://instagram.com/dupesdidit");
  });

  it("checks at most 25 links and survives a resolver error", async () => {
    extractArtistId.mockReset().mockImplementation(async () => {
      throw new Error("db");
    });
    const links = Array.from({ length: 30 }, (_, i) => `https://x.com/${i}`);
    expect(await resolveOutboundHandles(links)).toEqual([]);
    expect(extractArtistId).toHaveBeenCalledTimes(25);
  });
});
