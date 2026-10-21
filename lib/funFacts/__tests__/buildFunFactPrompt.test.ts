import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = vi.hoisted(() => ({ vault: vi.fn(), doc: vi.fn() }));
vi.mock("@/lib/vault/getVaultSourcesByStatus", () => ({
  getVaultSourcesByStatus: mock.vault,
}));
vi.mock("@/lib/lore/getArtistDocContext", () => ({ getArtistDocContext: mock.doc }));
const { buildFunFactPrompt } = await import("@/lib/funFacts/buildFunFactPrompt");

const artist = { id: "a1", name: "Bio Ritmo", spotify: "sp123" };
const base = "Share a lore drop about ARTIST_NAME (Spotify SPOTIFY_ID). ARTIST_NAME again.";

beforeEach(() => {
  vi.clearAllMocks();
  mock.vault.mockResolvedValue([]);
  mock.doc.mockResolvedValue(null);
});

describe("buildFunFactPrompt", () => {
  it("fills the stored placeholders the way MusicNerdWeb did: first occurrence only", async () => {
    expect(await buildFunFactPrompt(base, artist, false)).toBe(
      "Share a lore drop about Bio Ritmo (Spotify sp123). ARTIST_NAME again.",
    );
  });

  it("leaves SPOTIFY_ID when the artist has no Spotify id, and uses an empty name for a nameless artist", async () => {
    expect(await buildFunFactPrompt(base, { id: "a1", name: null, spotify: null }, false)).toBe(
      "Share a lore drop about  (Spotify SPOTIFY_ID). ARTIST_NAME again.",
    );
  });

  it("reads no context for an unclaimed artist", async () => {
    await buildFunFactPrompt(base, artist, false);
    expect(mock.vault).not.toHaveBeenCalled();
    expect(mock.doc).not.toHaveBeenCalled();
  });

  it("appends the approved vault sources and the Lore document for a claimed artist", async () => {
    mock.vault.mockResolvedValueOnce([
      { title: "Interview", url: "https://a", snippet: "snip", extractedText: "x".repeat(1500) },
      { title: null, url: "https://b", snippet: null, extractedText: null },
    ]);
    mock.doc.mockResolvedValueOnce("## Story hooks\n- The garage");
    const prompt = await buildFunFactPrompt("About ARTIST_NAME", artist, true);
    expect(mock.vault).toHaveBeenCalledWith("a1", "approved");
    expect(mock.doc).toHaveBeenCalledWith("a1");
    expect(prompt).toBe(
      "About Bio Ritmo" +
        "\n\nAdditional context provided by the artist:\n" +
        `Source: Interview — snip — ${"x".repeat(1000)}\nSource: https://b` +
        '\n\nArtist knowledge doc (compiled with the artist — prefer its "Story hooks"):\n' +
        "## Story hooks\n- The garage",
    );
  });

  it("appends nothing when the claimed artist has no approved sources or document", async () => {
    expect(await buildFunFactPrompt("About ARTIST_NAME", artist, true)).toBe("About Bio Ritmo");
  });

  it("goes on without a context whose read failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.vault.mockRejectedValueOnce(new Error("pool"));
    mock.doc.mockRejectedValueOnce(new Error("pool"));
    expect(await buildFunFactPrompt("About ARTIST_NAME", artist, true)).toBe("About Bio Ritmo");
  });
});
