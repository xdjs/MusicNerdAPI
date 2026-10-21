import { describe, it, expect, vi, beforeEach } from "vitest";

const getArtistDoc = vi.fn();
vi.mock("@/lib/lore/getArtistDoc", () => ({
  getArtistDoc: (...a: unknown[]) => getArtistDoc(...a),
}));
const { getArtistDocContext } = await import("@/lib/lore/getArtistDocContext");

beforeEach(() => getArtistDoc.mockReset());

describe("getArtistDocContext", () => {
  it("returns null when the artist has no document, or an empty one", async () => {
    getArtistDoc.mockResolvedValueOnce(undefined);
    expect(await getArtistDocContext("a1")).toBeNull();
    getArtistDoc.mockResolvedValueOnce({ content: "" });
    expect(await getArtistDocContext("a1")).toBeNull();
    expect(getArtistDoc).toHaveBeenCalledWith("a1");
  });

  it("strips citation markers before capping at 8,000 characters", async () => {
    const sentence = "Formed in Richmond [1] in 2019 [2, 3]. ";
    getArtistDoc.mockResolvedValueOnce({ content: sentence.repeat(400) });
    const context = await getArtistDocContext("a1");
    expect(context).not.toMatch(/\[\d/);
    expect(context?.startsWith("Formed in Richmond in 2019.")).toBe(true);
    expect(context).toHaveLength(8_000);
  });
});
