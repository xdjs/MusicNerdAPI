import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchPage, update } = vi.hoisted(() => ({ fetchPage: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/pages/fetchPageContent", () => ({ fetchPageContent: fetchPage }));
vi.mock("@/lib/vault/updateVaultSourceContent", () => ({ updateVaultSourceContent: update }));
const { enrichVaultSource } = await import("@/lib/onboarding/enrichVaultSource");

const page = {
  title: "Page",
  snippet: "s",
  extractedText: "e",
  ogImage: "i",
  podcastEpisode: { podcastEpisodeKey: "k" },
};

beforeEach(() => {
  fetchPage.mockReset().mockResolvedValue(page);
  update.mockReset().mockResolvedValue({});
});

describe("enrichVaultSource", () => {
  it("leaves ordinary URL bodies to durable ingestion without a detached fetch", async () => {
    await enrichVaultSource("s1", "https://example.com/a", { keepTitle: false });
    expect(fetchPage).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps a title we already have, and waits for a podcast episode", async () => {
    await enrichVaultSource("s1", "https://podcasts.apple.com/us/podcast/x/id1?i=2", {
      keepTitle: true,
    });
    expect(update).toHaveBeenCalledWith("s1", {
      podcastEpisodeKey: "k",
      snippet: "s",
      ogImage: "i",
    });
    expect(update.mock.calls[0][1]).not.toHaveProperty("extractedText");
  });

  it("never throws when the read or the write fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    update.mockRejectedValueOnce(new Error("pool"));
    await expect(
      enrichVaultSource("s1", "https://podcasts.apple.com/us/podcast/x/id1?i=2", {
        keepTitle: false,
      }),
    ).resolves.toBeUndefined();
    error.mockRestore();
  });
});
