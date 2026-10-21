import { describe, expect, it } from "vitest";
import { validateSpotifyDataQuery } from "@/lib/spotifyData/validateSpotifyDataQuery";

const q = (s: string) => validateSpotifyDataQuery(new URLSearchParams(s));
const err = async (r: unknown) => ({
  status: (r as Response).status,
  body: await (r as Response).json(),
});

describe("validateSpotifyDataQuery", () => {
  it("returns one trimmed id, or the batch when spotifyIds is sent", () => {
    expect(q("spotifyId=%20a%20")).toEqual({ spotifyId: "a" });
    expect(q("spotifyIds=a,%20b,,c&spotifyId=z")).toEqual({ spotifyIds: ["a", "b", "c"] });
    expect(q("spotifyIds=,&spotifyId=z")).toEqual({ spotifyId: "z" });
  });

  it("answers 400 without an id, or with more than 50", async () => {
    expect(await err(q(""))).toEqual({
      status: 400,
      body: { error: "spotifyId or spotifyIds is required" },
    });
    expect(await err(q(`spotifyIds=${Array.from({ length: 51 }, (_, i) => i).join(",")}`))).toEqual(
      {
        status: 400,
        body: { error: "Maximum 50 IDs allowed per request" },
      },
    );
  });
});
