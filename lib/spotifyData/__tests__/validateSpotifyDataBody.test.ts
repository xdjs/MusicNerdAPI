import { describe, expect, it } from "vitest";
import { validateSpotifyDataBody } from "@/lib/spotifyData/validateSpotifyDataBody";

const err = async (r: unknown) => ({
  status: (r as Response).status,
  body: await (r as Response).json(),
});

describe("validateSpotifyDataBody", () => {
  it("returns the trimmed, de-duplicated ids", () => {
    expect(validateSpotifyDataBody({ spotifyIds: [" a ", "b", "a", ""] })).toEqual(["a", "b"]);
  });

  it("answers 400 with MusicNerdWeb's messages", async () => {
    expect(await err(validateSpotifyDataBody({}))).toEqual({
      status: 400,
      body: { error: "spotifyIds array is required" },
    });
    expect(await err(validateSpotifyDataBody({ spotifyIds: [] }))).toEqual({
      status: 400,
      body: { error: "spotifyIds array is required" },
    });
    expect(await err(validateSpotifyDataBody({ spotifyIds: [" "] }))).toEqual({
      status: 400,
      body: { error: "No valid Spotify IDs provided" },
    });
    expect(
      await err(
        validateSpotifyDataBody({ spotifyIds: Array.from({ length: 51 }, (_, i) => `${i}`) }),
      ),
    ).toEqual({
      status: 400,
      body: { error: "Maximum 50 IDs allowed per request" },
    });
  });
});
