import { expect, it, vi } from "vitest";
import { loadCanvasSocialMedia } from "../loadCanvasSocialMedia";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), thumbnail: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mocks.execute } }));
vi.mock("@/lib/instagram/storedInstagramThumbnail", () => ({
  storedInstagramThumbnail: mocks.thumbnail,
}));
it("carries only verified retained thumbnails with exact post association", async () => {
  mocks.execute.mockResolvedValue([
    {
      url: "https://instagram.com/p/a/",
      platform_post_id: "123",
      raw: { displayUrl: "https://cdn.example/expired" },
    },
    { url: "https://instagram.com/p/b/", platform_post_id: "456", raw: {} },
  ]);
  mocks.thumbnail
    .mockReturnValueOnce({ url: "https://storage.example/retained.webp" })
    .mockReturnValueOnce(null);
  const media = await loadCanvasSocialMedia("artist");
  expect([...media]).toEqual([
    ["https://instagram.com/p/a/", "https://storage.example/retained.webp"],
  ]);
  expect(mocks.thumbnail).toHaveBeenCalledWith(
    { displayUrl: "https://cdn.example/expired" },
    "artist",
    "123",
  );
});
