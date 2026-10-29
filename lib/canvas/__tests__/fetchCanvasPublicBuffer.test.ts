import { afterEach, expect, it, vi } from "vitest";
import { fetchCanvasPublicBuffer } from "../fetchCanvasPublicBuffer";
import { canvasPublicProfile } from "../publicPdfManifest";
afterEach(() => vi.unstubAllGlobals());
it("rejects arbitrary URLs before fetching", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(fetchCanvasPublicBuffer("http://127.0.0.1/private", 100)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("uses anonymous no-redirect fetch and enforces streamed byte limits", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("123456"));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchCanvasPublicBuffer(canvasPublicProfile, 5)).rejects.toThrow("byte limit");
  expect(fetch).toHaveBeenCalledWith(
    canvasPublicProfile,
    expect.objectContaining({ redirect: "error", cache: "no-store" }),
  );
  expect(fetch.mock.calls[0][1]).not.toHaveProperty("headers");
});
it("returns bounded public bytes", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("public")));
  expect((await fetchCanvasPublicBuffer(canvasPublicProfile, 20)).toString()).toBe("public");
});
