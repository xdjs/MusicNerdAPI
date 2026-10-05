import { describe, it, expect, vi } from "vitest";

const { extractArtistId } = vi.hoisted(() => ({ extractArtistId: vi.fn() }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId }));
vi.mock("@/lib/sources/stripQuery", () => ({ stripQuery: (u: string) => u.split("?")[0] }));
const { resolveOutboundHandles } = await import("@/lib/vault/resolveOutboundHandles");

describe("resolveOutboundHandles", () => {
  it.each(["spotify", "youtubechannel"])(
    "preserves the case of a %s account ID",
    async siteName => {
      extractArtistId.mockReset().mockResolvedValue({ siteName, id: "AbC123" });
      expect(await resolveOutboundHandles(["https://example.com/profile"])).toEqual([
        { siteName, id: "AbC123" },
      ]);
    },
  );
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

it("never turns a release into a profile through a loose legacy URL mapping", async () => {
  extractArtistId
    .mockReset()
    .mockResolvedValue({ siteName: "spotify", id: "3DmaZbBPnKSGnxYRpHobss" });
  expect(
    await resolveOutboundHandles(["https://open.spotify.com/album/3DmaZbBPnKSGnxYRpHobss"]),
  ).toEqual([]);
  expect(extractArtistId).not.toHaveBeenCalled();
});

it("retains artist-scoped release handles as corroboration, never their release slug", async () => {
  extractArtistId.mockReset().mockResolvedValue({ siteName: "bandcamp", id: "wrong-release-id" });
  expect(
    await resolveOutboundHandles([
      "https://grimes.bandcamp.com/album/new-release",
      "https://soundcloud.com/grimes/sets/new-release",
    ]),
  ).toEqual([
    { siteName: "bandcamp", id: "grimes", corroborationOnly: true },
    { siteName: "soundcloud", id: "grimes", corroborationOnly: true },
  ]);
  expect(extractArtistId).not.toHaveBeenCalled();
});
