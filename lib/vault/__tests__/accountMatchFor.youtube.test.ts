import { describe, it, expect, vi } from "vitest";
import { urlmapRows } from "@/lib/artists/__tests__/urlmapRows";

vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks: async () => urlmapRows }));
const { accountMatchFor } = await import("@/lib/vault/accountMatchFor");

describe("YouTube account matching with real URL readers", () => {
  it.each([
    "https://www.youtube.com/watch?v=example",
    "https://www.youtube.com/shorts/example",
    "https://www.youtube.com/embed/example",
    "https://www.youtube.com/live/example",
    "https://www.youtube.com/playlist?list=example",
    "https://youtu.be/example",
  ])("never treats a video or playlist as an artist account: %s", async url => {
    expect((await accountMatchFor(url)).isAccountUrl).toBe(false);
  });

  it.each([
    ["https://www.youtube.com/@svaneborgkardyb", "youtube", "svaneborgkardyb"],
    [
      "https://www.youtube.com/channel/UCh7KEjrvinFL2zZc_lz4LwQ",
      "youtubechannel",
      "UCh7KEjrvinFL2zZc_lz4LwQ",
    ],
  ])("recognizes an actual channel URL: %s", async (url, siteName, id) => {
    expect(await accountMatchFor(url)).toMatchObject({
      isAccountUrl: true,
      match: { siteName, id },
    });
  });
});
