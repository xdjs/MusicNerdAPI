import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";

const { getArtistById, adoptHandlesFromOwnPage } = vi.hoisted(() => ({
  getArtistById: vi.fn(),
  adoptHandlesFromOwnPage: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById }));
vi.mock("@/lib/vault/adoptHandlesFromOwnPage", () => ({ adoptHandlesFromOwnPage }));
const { adoptFromHubs } = await import("@/lib/vault/adoptFromHubs");

const hub = (url: string, links: string[], aboutArtist = true) => ({ url, links, aboutArtist });
beforeEach(() => {
  getArtistById.mockReset().mockResolvedValue({ id: "a1", name: "Grimes", bandcamp: null });
  adoptHandlesFromOwnPage.mockReset().mockResolvedValue({ adopted: 0, handles: new Set() });
});

describe("adoptFromHubs", () => {
  it("does not let a rejected publisher suppress an owned page with the same outbound links", async () => {
    const official = "https://svaneborgkardyb.bandcamp.com";
    const links = ["https://youtube.com/@svaneborgkardyb"];
    adoptHandlesFromOwnPage.mockImplementation(async (_id, _links, _artist, _name, page) =>
      page.url === official
        ? { adopted: 1, handles: new Set(["svaneborgkardyb"]) }
        : { adopted: 0, handles: new Set() },
    );
    const run = searchRun({
      hubCandidates: [hub("https://publisher.example/review", links), hub(official, links)],
    });
    await adoptFromHubs(run);
    expect([...run.verifiedHandles]).toEqual(["svaneborgkardyb"]);
    expect(adoptHandlesFromOwnPage).toHaveBeenCalledTimes(2);
  });

  it("re-reads the artist, deduplicates repeated page/link sets and collects verified handles", async () => {
    adoptHandlesFromOwnPage.mockResolvedValueOnce({ adopted: 1, handles: new Set(["dupesdidit"]) });
    const run = searchRun({
      hubCandidates: [
        hub("https://a.com", ["x", "y"]),
        hub("https://a.com", ["y", "x"]),
        hub("https://c.com", ["z"], false),
      ],
    });
    await adoptFromHubs(run);
    expect(adoptHandlesFromOwnPage).toHaveBeenCalledTimes(2);
    expect(adoptHandlesFromOwnPage).toHaveBeenCalledWith(
      "a1",
      ["x", "y"],
      expect.objectContaining({ id: "a1" }),
      "Grimes",
      { url: "https://a.com", aboutArtist: true },
      run.provisional,
      run,
    );
    expect([...run.verifiedHandles]).toEqual(["dupesdidit"]);
    // One adoption can corroborate the next page, so it re-reads.
    expect(getArtistById).toHaveBeenCalledTimes(2);
  });

  it("does nothing without hubs, and gives up quietly when the artist can't be re-read", async () => {
    await adoptFromHubs(searchRun());
    getArtistById.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    await adoptFromHubs(searchRun({ hubCandidates: [hub("https://a.com", ["x"])] }));
    expect(adoptHandlesFromOwnPage).not.toHaveBeenCalled();
  });

  it("examines at most five pages and throws for a durable run out of time", async () => {
    const hubs = Array.from({ length: 7 }, (_, i) => hub(`https://h${i}.com`, [`l${i}`]));
    await adoptFromHubs(searchRun({ hubCandidates: hubs }));
    expect(adoptHandlesFromOwnPage).toHaveBeenCalledTimes(5);
    await expect(
      adoptFromHubs(
        searchRun({ hubCandidates: hubs, deadline: Date.now() - 1, requireComplete: true }),
      ),
    ).rejects.toThrow("hub adoption");
  });
});
