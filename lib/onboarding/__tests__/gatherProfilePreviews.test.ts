import { describe, it, expect, vi, beforeEach } from "vitest";

const { preview } = vi.hoisted(() => ({ preview: vi.fn() }));
vi.mock("@/lib/pages/fetchLinkPreview", () => ({ fetchLinkPreview: preview }));
const { gatherProfilePreviews } = await import("@/lib/onboarding/gatherProfilePreviews");

beforeEach(() => {
  preview
    .mockReset()
    .mockImplementation(async (url: string) => ({ imageUrl: `${url}/img`, title: null }));
});

describe("gatherProfilePreviews", () => {
  it("fetches every preview in parallel, keyed by site", async () => {
    const got = await gatherProfilePreviews([
      ["instagram", "https://ig/pete"],
      ["x", "https://x/pete"],
    ]);
    expect(Object.fromEntries(got)).toEqual({
      instagram: "https://ig/pete/img",
      x: "https://x/pete/img",
    });
  });

  it("returns what arrived within five seconds and leaves the rest out", async () => {
    vi.useFakeTimers();
    try {
      preview.mockImplementation(async (url: string) =>
        url.includes("slow") ? new Promise(() => {}) : { imageUrl: "i", title: null },
      );
      const pending = gatherProfilePreviews([
        ["instagram", "https://fast"],
        ["x", "https://slow"],
      ]);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(Object.fromEntries(await pending)).toEqual({ instagram: "i" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("is empty for no entries", async () => {
    expect((await gatherProfilePreviews([])).size).toBe(0);
    expect(preview).not.toHaveBeenCalled();
  });
});
