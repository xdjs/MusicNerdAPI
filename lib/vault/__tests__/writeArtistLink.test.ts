import { describe, it, expect, vi } from "vitest";

const { setArtistLink } = vi.hoisted(() => ({
  setArtistLink: vi.fn(async (_a: string, _site: string, _value: string) => ({
    oldValue: null,
    artistName: null,
  })),
}));
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink }));
const { writeArtistLink } = await import("@/lib/vault/writeArtistLink");

describe("writeArtistLink", () => {
  it("writes, then stops calling the column provisional and updates the snapshot later gates read", async () => {
    const provisional = new Set(["bandcamp", "x"]);
    const record: Record<string, unknown> = { bandcamp: "guess" };
    await writeArtistLink("a1", "bandcamp", "dupes", provisional, record);
    expect(setArtistLink).toHaveBeenCalledWith("a1", "bandcamp", "dupes");
    expect([...provisional]).toEqual(["x"]);
    expect(record.bandcamp).toBe("dupes");
  });

  it("leaves both untouched when the write throws", async () => {
    setArtistLink.mockImplementationOnce(async () => {
      throw new Error("conflict");
    });
    const provisional = new Set(["bandcamp"]);
    const record: Record<string, unknown> = {};
    await expect(writeArtistLink("a1", "bandcamp", "dupes", provisional, record)).rejects.toThrow(
      "conflict",
    );
    expect(provisional.has("bandcamp")).toBe(true);
    expect(record.bandcamp).toBeUndefined();
  });
});
