import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { DUTCH_ARTIST_ID } from "../const";
import { canvasPublicPdfs, canvasPublicProfile } from "../publicPdfManifest";
import { loadCanvasPublicPdfOriginals } from "../loadCanvasPublicPdfOriginals";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), extract: vi.fn() }));
vi.mock("../fetchCanvasPublicBuffer", () => ({ fetchCanvasPublicBuffer: mocks.fetch }));
vi.mock("../extractCanvasPdfPages", () => ({ extractCanvasPdfPages: mocks.extract }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("MUSICNERD_CANVAS_PREVIEW_ENABLED", "1");
});
afterEach(() => vi.unstubAllEnvs());
it("requires actual public download links, not filenames embedded in private metadata", async () => {
  mocks.fetch.mockResolvedValue(Buffer.from(JSON.stringify({ url: canvasPublicPdfs[0].url })));
  const result = await loadCanvasPublicPdfOriginals(DUTCH_ARTIST_ID);
  expect(result.sources).toEqual([]);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("retrieves only linked allowlisted files and retains physical page provenance", async () => {
  mocks.fetch.mockImplementation(async (url: string) =>
    Buffer.from(
      url === canvasPublicProfile ? `<a href="${canvasPublicPdfs[0].url}">PDF</a>` : "%PDF-fixture",
    ),
  );
  mocks.extract.mockResolvedValue(["Artist preface.", "Foreword by another writer."]);
  const result = await loadCanvasPublicPdfOriginals(DUTCH_ARTIST_ID);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(result.sources).toHaveLength(2);
  expect(result.sources[1].url).toBe(canvasPublicPdfs[0].url + "#page=2");
  expect(result.sources[1].pdf?.limitation).toContain("foreword");
  expect(result.sources[1].publishedAt).toBeNull();
});
it("does not fetch for another artist or production", async () => {
  await loadCanvasPublicPdfOriginals("foreign");
  vi.stubEnv("VERCEL_ENV", "production");
  await loadCanvasPublicPdfOriginals(DUTCH_ARTIST_ID);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("reports missing coverage without inventing pages on failure", async () => {
  mocks.fetch.mockRejectedValue(new Error("offline"));
  const result = await loadCanvasPublicPdfOriginals(DUTCH_ARTIST_ID);
  expect(result.sources).toEqual([]);
  expect(result.limitations[0]).toContain("unavailable");
});
