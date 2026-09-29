import { describe, it, expect, vi } from "vitest";

const { fetchPageContent } = vi.hoisted(() => ({ fetchPageContent: vi.fn() }));
vi.mock("@/lib/pages/fetchPageContent", () => ({ fetchPageContent }));
const { pageNamesArtist } = await import("@/lib/vault/pageNamesArtist");

describe("pageNamesArtist", () => {
  it("reads the page with the verify timeout and checks its title names the artist", async () => {
    fetchPageContent.mockResolvedValueOnce({ title: "Dupes Did It Music Inc (@dupesdiditmusic)" });
    expect(
      await pageNamesArtist("https://instagram.com/dupesdiditmusic", "Sherwinn Dupes Brice"),
    ).toBe(false);
    expect(fetchPageContent).toHaveBeenCalledWith("https://instagram.com/dupesdiditmusic", {
      timeoutMs: 8000,
    });
    fetchPageContent.mockResolvedValueOnce({ title: "Pete Rango (@p3t3rango)" });
    expect(await pageNamesArtist("https://instagram.com/p3t3rango", "Pete Rango")).toBe(true);
  });

  it("is false when the page can't be read or has no title", async () => {
    fetchPageContent.mockImplementationOnce(async () => {
      throw new Error("timeout");
    });
    expect(await pageNamesArtist("https://a.com", "Pete Rango")).toBe(false);
    fetchPageContent.mockResolvedValueOnce({ title: "" });
    expect(await pageNamesArtist("https://a.com", "Pete Rango")).toBe(false);
  });
});
