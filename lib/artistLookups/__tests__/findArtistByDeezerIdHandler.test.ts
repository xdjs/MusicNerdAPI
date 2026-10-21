import { beforeEach, describe, expect, it, vi } from "vitest";

const { find, claim, about } = vi.hoisted(() => ({
  find: vi.fn(),
  claim: vi.fn(),
  about: vi.fn(),
}));
vi.mock("@/lib/artistLookups/findArtistByColumn", () => ({ findArtistByColumn: find }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: claim }));
vi.mock("@/lib/bio/getPublicArtistAbout", () => ({ getPublicArtistAbout: about }));
vi.mock("@/lib/db/db", () => ({ db: { query: {} } }));
const { findArtistByDeezerIdHandler } =
  await import("@/lib/artistLookups/findArtistByDeezerIdHandler");
const { lookupArtists } = await import("@/lib/artistLookups/lookupArtists");

const post = (body: string) =>
  findArtistByDeezerIdHandler(
    new Request("https://api.test/api/findArtistByDeezerID", { method: "POST", body }),
  );
const row = { id: "a1", name: "David Morales", deezer: "11600", bio: "Private prepared About" };

beforeEach(() => {
  find.mockReset();
  claim.mockReset().mockResolvedValue(undefined);
  about.mockReset().mockResolvedValue(null);
});

describe("findArtistByDeezerIdHandler", () => {
  it("returns the identity but hides the prepared About without a claim, private and uncached", async () => {
    find.mockResolvedValueOnce(row);
    const r = await post('{"deezerID":"11600"}');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ result: { ...row, bio: null } });
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(find).toHaveBeenCalledWith(lookupArtists.deezer, "11600");
  });

  it("returns the public directory About for an unclaimed artist when one qualifies", async () => {
    find.mockResolvedValueOnce(row);
    about.mockResolvedValueOnce({ bio: "Public About", kind: "researched", sources: [] });
    expect(await (await post('{"deezerID":"11600"}')).json()).toEqual({
      result: { ...row, bio: "Public About" },
    });
    expect(about).toHaveBeenCalledWith("a1");
  });

  it("returns the artist's own About once claimed, without consulting the directory", async () => {
    find.mockResolvedValueOnce(row);
    claim.mockResolvedValueOnce({ id: "c1" });
    expect(await (await post('{"deezerID":"11600"}')).json()).toEqual({ result: row });
    expect(about).not.toHaveBeenCalled();
  });

  it("answers MusicNerdWeb's plain-text 400 and 404", async () => {
    for (const body of ["{}", '{"deezerID":11600}', "nope"]) {
      const r = await post(body);
      expect(r.status).toBe(400);
      expect(await r.text()).toBe("Missing or invalid required parameters: deezerID");
    }
    find.mockResolvedValueOnce(undefined);
    const r = await post('{"deezerID":"0"}');
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("The artist you're searching for is not found");
  });

  it("answers 500 when the database fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    find.mockRejectedValueOnce(new Error("pool"));
    const r = await post('{"deezerID":"11600"}');
    expect(r.status).toBe(500);
    expect(await r.text()).toBe("Something went wrong on our end");
    error.mockRestore();
  });
});
