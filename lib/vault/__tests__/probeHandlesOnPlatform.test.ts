import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  preview: vi.fn(),
  belongs: vi.fn(async (_artistId: string, _site: string, _handle: string) => false),
  contradicts: vi.fn(async (_artistId: string, _site: string, _handle: string) => false),
}));
vi.mock("@/lib/pages/fetchLinkPreview", () => ({ fetchLinkPreview: m.preview }));
vi.mock("@/lib/identity/handleBelongsToAnotherArtist", () => ({
  handleBelongsToAnotherArtist: m.belongs,
}));
vi.mock("@/lib/identity/contradictsScrapedPosts", () => ({
  contradictsScrapedPosts: m.contradicts,
}));
const { probeHandlesOnPlatform } = await import("@/lib/vault/probeHandlesOnPlatform");

beforeEach(() => vi.clearAllMocks());

describe("probeHandlesOnPlatform", () => {
  it("keeps the handles whose probed page title names the artist", async () => {
    m.preview.mockImplementation(async (u: string) => ({
      imageUrl: null,
      title: u.endsWith("p3t3rango") ? "Pete Rango - YouTube" : "YouTube",
    }));
    expect(
      await probeHandlesOnPlatform(
        "a1",
        "youtube",
        "https://youtube.com/@%@",
        ["p3t3rango", "peterango"],
        "Pete Rango",
        Infinity,
      ),
    ).toEqual({ resolved: ["p3t3rango"], scannedAll: true });
    expect(m.preview).toHaveBeenCalledWith("https://youtube.com/@p3t3rango");
  });

  it("skips reserved handles, other artists' handles and contradicted ones without probing", async () => {
    m.belongs.mockImplementationOnce(async () => true);
    m.contradicts.mockImplementationOnce(async () => true);
    expect(
      await probeHandlesOnPlatform(
        "a1",
        "instagram",
        "https://instagram.com/%@",
        ["taken", "wrong", "p"],
        "Pete Rango",
        Infinity,
      ),
    ).toEqual({ resolved: [], scannedAll: true });
    expect(m.preview).not.toHaveBeenCalled();
  });

  it("reports an unfinished scan when the deadline passes, and survives a failed probe", async () => {
    m.preview.mockImplementationOnce(async () => {
      throw new Error("timeout");
    });
    expect(
      await probeHandlesOnPlatform(
        "a1",
        "soundcloud",
        "https://soundcloud.com/%@",
        ["a1x"],
        "Pete",
        Infinity,
      ),
    ).toEqual({
      resolved: [],
      scannedAll: true,
    });
    expect(
      await probeHandlesOnPlatform(
        "a1",
        "soundcloud",
        "https://soundcloud.com/%@",
        ["a1x"],
        "Pete",
        Date.now() - 1,
      ),
    ).toEqual({
      resolved: [],
      scannedAll: false,
    });
  });
});

it("marks the final probe incomplete when its fetch consumes the remaining deadline", async () => {
  let now = 1000;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try {
    m.preview.mockImplementationOnce(async () => {
      now = 3000;
      return { title: "Pete Rango" };
    });
    expect(
      await probeHandlesOnPlatform(
        "a1",
        "soundcloud",
        "https://soundcloud.com/%@",
        ["peterango"],
        "Pete Rango",
        2000,
      ),
    ).toEqual({ resolved: [], scannedAll: false });
  } finally {
    clock.mockRestore();
  }
});
