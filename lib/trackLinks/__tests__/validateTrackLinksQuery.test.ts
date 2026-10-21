import { describe, expect, it } from "vitest";
import { validateTrackLinksQuery } from "@/lib/trackLinks/validateTrackLinksQuery";

const q = (s: string) => validateTrackLinksQuery(new URLSearchParams(s));

describe("validateTrackLinksQuery", () => {
  it("returns the trimmed title and artist and whether an album is wanted", () => {
    expect(q("title=%20Rush%20&artist=Pete%20Rango")).toEqual({
      title: "Rush",
      artist: "Pete Rango",
      isAlbum: false,
    });
    expect(q("title=Cast&artist=Pete&kind=album")).toEqual({
      title: "Cast",
      artist: "Pete",
      isAlbum: true,
    });
    expect(q("title=Cast&artist=Pete&kind=song")).toMatchObject({ isAlbum: false });
  });

  it("answers 400 when either is missing", async () => {
    for (const s of ["title=Rush", "artist=Pete", "title=%20&artist=Pete", ""]) {
      const r = q(s);
      expect(r).toBeInstanceOf(Response);
      expect((r as Response).status).toBe(400);
      expect(await (r as Response).json()).toEqual({ error: "title and artist are required" });
    }
  });

  it("answers 400 when either is longer than 200 characters", async () => {
    const r = q(`title=${"a".repeat(201)}&artist=Pete`) as Response;
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "title or artist too long" });
  });
});
