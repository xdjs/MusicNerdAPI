import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mock = vi.hoisted(() => ({
  artist: vi.fn(),
  claim: vi.fn(),
  prompts: vi.fn(),
  build: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mock.artist }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.claim }));
vi.mock("@/lib/funFacts/getFunFactPrompts", () => ({ getFunFactPrompts: mock.prompts }));
vi.mock("@/lib/funFacts/buildFunFactPrompt", () => ({ buildFunFactPrompt: mock.build }));
vi.mock("@/lib/funFacts/generateFunFact", () => ({ generateFunFact: mock.generate }));
vi.mock("@/lib/db/db", () => ({ db: { query: {} } }));
const { getFunFactHandler } = await import("@/lib/funFacts/getFunFactHandler");

const request = (query = "?id=a1") => new Request(`https://api/api/funFacts/lore${query}`);
const artist = { id: "a1", name: "Bio Ritmo", spotify: "sp123" };
const prompts = {
  id: 1,
  surpriseMe: "Surprise ARTIST_NAME",
  loreDrop: "Lore ARTIST_NAME",
  behindTheScenes: null,
  recentActivity: "Activity ARTIST_NAME",
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mock.artist.mockResolvedValue(artist);
  mock.claim.mockResolvedValue(undefined);
  mock.prompts.mockResolvedValue(prompts);
  mock.build.mockImplementation(async (base: string) => `${base}!`);
  mock.generate.mockResolvedValue("A fact.");
});
afterEach(() => vi.useRealTimers());

describe("getFunFactHandler", () => {
  it("returns the fact for an unclaimed artist, with the prompt built without context", async () => {
    const res = await getFunFactHandler(request(), "lore");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", text: "A fact." });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(mock.artist).toHaveBeenCalledWith("a1");
    expect(mock.claim).toHaveBeenCalledWith(expect.anything(), "a1");
    expect(mock.build).toHaveBeenCalledWith("Lore ARTIST_NAME", artist, false);
    expect(mock.generate).toHaveBeenCalledWith("Lore ARTIST_NAME!");
  });

  it("releases the context when the artist has an approved claim", async () => {
    mock.claim.mockResolvedValueOnce({ id: "c1" });
    await getFunFactHandler(request(), "activity");
    expect(mock.build).toHaveBeenCalledWith("Activity ARTIST_NAME", artist, true);
  });

  it("answers 400 before any read when the id is missing", async () => {
    const res = await getFunFactHandler(request(""), "lore");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Missing artist id" });
    expect(mock.artist).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown artist, even with an invalid type", async () => {
    mock.artist.mockResolvedValueOnce(undefined);
    const res = await getFunFactHandler(request(), "nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Artist not found" });
    expect(mock.prompts).not.toHaveBeenCalled();
  });

  it("answers 500 when there is no active prompt row", async () => {
    mock.prompts.mockResolvedValueOnce(null);
    const res = await getFunFactHandler(request(), "lore");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to fetch prompts" });
    expect(mock.build).not.toHaveBeenCalled();
  });

  it.each(["nope", "constructor", "bts"])(
    "answers 400 for a type with no prompt (%s)",
    async type => {
      const res = await getFunFactHandler(request(), type);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ status: "error", error: "Invalid fun fact type" });
      expect(mock.generate).not.toHaveBeenCalled();
    },
  );

  it("answers 408 when the model times out, 500 when it fails", async () => {
    mock.generate.mockRejectedValueOnce(new Error("Gemini timeout"));
    const timedOut = await getFunFactHandler(request(), "surprise");
    expect(timedOut.status).toBe(408);
    expect(await timedOut.json()).toEqual({
      status: "error",
      error: "Fun fact generation timed out",
    });

    mock.generate.mockRejectedValueOnce(new Error("gateway"));
    const failed = await getFunFactHandler(request(), "surprise");
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ status: "error", error: "Failed to generate fun fact" });
  });

  it("answers 408 when the whole request passes 20 seconds", async () => {
    vi.useFakeTimers();
    mock.generate.mockReturnValueOnce(new Promise(() => {}));
    const pending = getFunFactHandler(request(), "lore");
    await vi.advanceTimersByTimeAsync(20_000);
    const res = await pending;
    expect(res.status).toBe(408);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Fun fact generation timed out. Please try again later.",
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers 500 when a read throws, and clears its timer", async () => {
    vi.useFakeTimers();
    mock.artist.mockRejectedValueOnce(new Error("Error fetching artist by Id"));
    const res = await getFunFactHandler(request(), "lore");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
