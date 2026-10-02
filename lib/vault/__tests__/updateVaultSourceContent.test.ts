import { describe, it, expect, vi, beforeEach } from "vitest";

const { write, returning, set, where } = vi.hoisted(() => {
  const returning = vi.fn();
  const where = vi.fn((..._a: unknown[]) => ({ returning }));
  const set = vi.fn((..._a: unknown[]) => ({ where }));
  return { write: vi.fn(), returning, set, where };
});
const tx = { update: vi.fn(() => ({ set })) };
vi.mock("@/lib/vault/withVaultSourceWrite", () => ({ withVaultSourceWrite: write }));
const { updateVaultSourceContent } = await import("@/lib/vault/updateVaultSourceContent");

beforeEach(() => {
  write.mockReset().mockImplementation(async (_id, fn) => fn(tx, "PRED"));
  returning.mockReset().mockResolvedValue([{ id: "s1" }]);
  set.mockClear();
});

describe("updateVaultSourceContent", () => {
  it("sets only the fields given, plus updatedAt", async () => {
    expect(await updateVaultSourceContent("s1", { snippet: "s", extractedText: null })).toEqual({
      id: "s1",
    });
    const fields = set.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(Object.keys(fields).sort()).toEqual(["extractedText", "snippet", "updatedAt"]);
    expect(fields.snippet).toBe("s");
    expect(fields.extractedText).toBeNull();
    expect(where).toHaveBeenCalledWith("PRED");
  });

  it("carries the podcast identity and publication date", async () => {
    await updateVaultSourceContent("s1", {
      title: "t",
      ogImage: "i",
      podcastEpisodeKey: "k",
      podcastShowTitle: "show",
      podcastEpisodeTitle: "ep",
      publishedAt: "2020-01-01",
    });
    expect(set.mock.calls[0][0]).toMatchObject({
      title: "t",
      ogImage: "i",
      podcastEpisodeKey: "k",
      podcastShowTitle: "show",
      podcastEpisodeTitle: "ep",
      publishedAt: "2020-01-01",
    });
  });

  it("rethrows a failed write", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    write.mockRejectedValueOnce(new Error("pool"));
    await expect(updateVaultSourceContent("s1", {})).rejects.toThrow("pool");
    error.mockRestore();
  });
});
