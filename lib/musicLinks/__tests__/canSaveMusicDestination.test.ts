import { describe, it, expect, vi } from "vitest";
import { canSaveMusicDestination } from "../canSaveMusicDestination";
const url = "https://music.apple.com/us/artist/pete-rango/1513734272";
function writer({
  mappings = [],
  sources = [],
  excluded = [],
}: { mappings?: object[]; sources?: object[]; excluded?: object[] } = {}) {
  return {
    execute: vi
      .fn()
      .mockResolvedValueOnce(mappings)
      .mockResolvedValueOnce(excluded)
      .mockResolvedValueOnce(sources),
  };
}
describe("canSaveMusicDestination", () => {
  it("allows a new profile without changing any mapping", async () => {
    const tx = writer();
    expect(await canSaveMusicDestination(tx as never, "a1", url)).toBe(true);
    expect(tx.execute).toHaveBeenCalledTimes(3);
  });
  it.each([
    { mappings: [{ artist_id: "a1", platform_id: "42" }] },
    { mappings: [{ artist_id: "other", platform_id: "1513734272" }] },
    { excluded: [{ reason: "name_mismatch" }] },
    { sources: [{ url: "https://itunes.apple.com/us/artist/id1513734272", status: "rejected" }] },
    { sources: [{ url: "https://music.apple.com/artist/42", status: "approved" }] },
    { sources: [{ url: "https://music.apple.com/artist/1513734272", status: "pending" }] },
  ])("preserves prior identity/review decisions: %j", async rows => {
    expect(await canSaveMusicDestination(writer(rows) as never, "a1", url)).toBe(false);
  });
  it("does not let release IDs compete with artist IDs", async () => {
    const tx = { execute: vi.fn() };
    expect(
      await canSaveMusicDestination(tx as never, "a1", "https://music.apple.com/album/rush/42"),
    ).toBe(true);
    expect(tx.execute).not.toHaveBeenCalled();
  });
  it("allows the same mapping and ignores unrelated platform sources", async () => {
    expect(
      await canSaveMusicDestination(
        writer({
          mappings: [{ artist_id: "a1", platform_id: "1513734272" }],
          sources: [{ url: "https://www.beatport.com/artist/pete/1041889", status: "approved" }],
        }) as never,
        "a1",
        url,
      ),
    ).toBe(true);
  });
});
