import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchOgPreview } from "@/lib/pages/fetchOgPreview";

afterEach(() => vi.unstubAllGlobals());

describe("fetchOgPreview", () => {
  it("scrapes og:image and og:title with the bot UA", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        '<meta content="https://cdn.example/p.jpg" property="og:image"><meta property="og:title" content="Nova (@nova)">',
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchOgPreview("https://instagram.com/nova")).toEqual({
      imageUrl: "https://cdn.example/p.jpg",
      title: "Nova (@nova)",
    });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toEqual({ "User-Agent": "MusicNerdBot/1.0" });
  });

  it("resolves to nulls on a failed or unreadable response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    expect(await fetchOgPreview("https://a.example")).toEqual({ imageUrl: null, title: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => {
          throw new Error("bad");
        },
      })),
    );
    expect(await fetchOgPreview("https://a.example")).toEqual({ imageUrl: null, title: null });
  });
});
