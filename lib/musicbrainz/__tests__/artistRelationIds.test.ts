import { describe, it, expect } from "vitest";
import { artistRelationIds } from "@/lib/musicbrainz/artistRelationIds";

const mbid = "a74b1b7f-71a5-4011-9441-d0b5e4122711";

describe("artistRelationIds", () => {
  it("collects the related artists' ids", () => {
    expect(
      artistRelationIds({ relations: [{ "target-type": "artist", artist: { id: mbid } }] }),
    ).toEqual({ status: "ok", ids: new Set([mbid]) });
  });

  it("is invalid for a non-artist relation or a bad id", () => {
    expect(artistRelationIds({ relations: [{ "target-type": "url" }] })).toEqual({
      status: "invalid",
    });
    expect(
      artistRelationIds({ relations: [{ "target-type": "artist", artist: { id: "x" } }] }),
    ).toEqual({ status: "invalid" });
  });
});
