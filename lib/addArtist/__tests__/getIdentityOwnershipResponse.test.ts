import { describe, it, expect } from "vitest";
import { getIdentityOwnershipResponse } from "@/lib/addArtist/getIdentityOwnershipResponse";

const submittedIdentity = { platform: "spotify" as const, platformId: "s1" };
const reciprocalIdentity = {
  platform: "deezer" as const,
  platformId: "1",
  source: "wikidata" as const,
  wikidataId: "Q1",
};
const a = { id: "a", name: "A", spotify: "s1", deezer: null };
const b = { id: "b", name: "B", spotify: null, deezer: "1" };
const none = { status: "none" as const };
const base = {
  submittedIdentity,
  reciprocalIdentity: null,
  submittedOwnership: none,
  reciprocalOwnership: none,
  forceCreate: false,
};

describe("getIdentityOwnershipResponse", () => {
  it("is null when nobody holds either id", () => {
    expect(getIdentityOwnershipResponse(base)).toBeNull();
  });

  it("is exists when the submitted id already has an artist", () => {
    expect(
      getIdentityOwnershipResponse({ ...base, submittedOwnership: { status: "owner", owner: a } }),
    ).toEqual({
      result: "exists",
      artistId: "a",
      artistName: "A",
      message: "That artist is already in our database",
    });
  });

  it("is a conflict for conflicting records or two different owners", () => {
    expect(
      getIdentityOwnershipResponse({
        ...base,
        submittedOwnership: { status: "conflict", candidates: [a, b] },
      }),
    ).toMatchObject({
      result: "conflict",
      candidates: [a, b],
      message: "Those platform profiles are assigned to conflicting artist records",
    });
    expect(
      getIdentityOwnershipResponse({
        ...base,
        reciprocalIdentity,
        submittedOwnership: { status: "owner", owner: a },
        reciprocalOwnership: { status: "owner", owner: b },
      }),
    ).toMatchObject({
      result: "conflict",
      message: "The matching Spotify and Deezer profiles belong to different artist records",
    });
  });

  it("offers the other platform's owner, and refuses a forced separate artist", () => {
    const withOwner = {
      ...base,
      reciprocalIdentity,
      reciprocalOwnership: { status: "owner" as const, owner: b },
    };
    expect(getIdentityOwnershipResponse(withOwner)).toEqual({
      result: "possible_duplicate",
      candidates: [b],
      platform: "spotify",
      platformId: "s1",
      canCreateSeparate: false,
      message:
        "Wikidata links this profile to an existing artist's deezer profile. Add the submitted link to that artist.",
    });
    expect(getIdentityOwnershipResponse({ ...withOwner, forceCreate: true })).toMatchObject({
      result: "conflict",
      message: "The matching deezer profile already belongs to another artist",
    });
  });
});
