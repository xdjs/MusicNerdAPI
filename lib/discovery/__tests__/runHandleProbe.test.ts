import { describe, it, expect, vi, beforeEach } from "vitest";
import { URLMAP_BY_SITE } from "@/lib/discovery/__tests__/urlmapRows";

const { fetchLinkPreview } = vi.hoisted(() => ({ fetchLinkPreview: vi.fn() }));
vi.mock("@/lib/pages/fetchLinkPreview", () => ({ fetchLinkPreview }));
const { runHandleProbe } = await import("@/lib/discovery/runHandleProbe");

const probe = (platform: string, handle: string, confirmed: boolean) =>
  ({ platform, handle, source: "s", confirmed }) as never;

beforeEach(() => {
  fetchLinkPreview.mockReset();
});

describe("runHandleProbe", () => {
  it("hits when the residual title names the artist", async () => {
    fetchLinkPreview.mockResolvedValueOnce({ imageUrl: null, title: "Pete Rango - YouTube" });
    expect(
      await runHandleProbe(probe("youtube", "peterango", false), URLMAP_BY_SITE, "Pete Rango"),
    ).toEqual({
      url: "https://youtube.com/@peterango",
      preview: { imageUrl: null, title: "Pete Rango - YouTube" },
    });
  });

  it("misses a stranger's page that only echoes the handle", async () => {
    fetchLinkPreview.mockResolvedValueOnce({
      imageUrl: null,
      title: "Peter Lyrøholm (@peterango) • Instagram photos and videos",
    });
    expect(
      await runHandleProbe(probe("instagram", "peterango", false), URLMAP_BY_SITE, "Pete Rango"),
    ).toBeNull();
  });

  it("trusts an image with no usable title only for a confirmed handle", async () => {
    fetchLinkPreview.mockResolvedValue({ imageUrl: "https://i", title: null });
    expect(
      await runHandleProbe(probe("instagram", "p3t3rango", false), URLMAP_BY_SITE, "Pete Rango"),
    ).toBeNull();
    expect(
      await runHandleProbe(probe("instagram", "p3t3rango", true), URLMAP_BY_SITE, "Pete Rango"),
    ).toMatchObject({
      url: "https://instagram.com/p3t3rango",
    });
  });

  it("records a platform that served its own name as the title with an image (a wall), and misses", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchLinkPreview.mockResolvedValueOnce({ imageUrl: "https://i", title: "Instagram" });
    const walled = new Set<never>();
    expect(
      await runHandleProbe(probe("instagram", "pete", false), URLMAP_BY_SITE, "Pete Rango", walled),
    ).toBeNull();
    expect([...walled]).toEqual(["instagram"]);
    warn.mockRestore();
  });

  it("misses a platform with no URL template and never throws", async () => {
    expect(
      await runHandleProbe(probe("twitch", "p", true), URLMAP_BY_SITE, "Pete Rango"),
    ).toBeNull();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchLinkPreview.mockRejectedValueOnce(new Error("net"));
    expect(await runHandleProbe(probe("x", "p", true), URLMAP_BY_SITE, "Pete Rango")).toBeNull();
    error.mockRestore();
  });
});
