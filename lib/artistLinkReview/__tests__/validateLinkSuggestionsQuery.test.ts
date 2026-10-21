import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateLinkSuggestionsQuery } from "@/lib/artistLinkReview/validateLinkSuggestionsQuery";

const id = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const req = (qs = "") => new Request(`https://api.test/api/artist/${id}/link-suggestions${qs}`);

describe("validateLinkSuggestionsQuery", () => {
  it("defaults the offset to 0 and reads a given one", () => {
    expect(validateLinkSuggestionsQuery(req(), id)).toEqual({ artistId: id, offset: 0 });
    expect(validateLinkSuggestionsQuery(req("?offset=100"), id)).toEqual({
      artistId: id,
      offset: 100,
    });
  });

  it.each([
    ["nope", "", "Invalid artist ID"],
    [id, "?offset=-1", "Invalid page offset"],
    [id, "?offset=1.5", "Invalid page offset"],
    [id, "?offset=abc", "Invalid page offset"],
    [id, "?offset=100001", "Invalid page offset"],
  ])("400s %s%s with %s", async (artistId, qs, message) => {
    const res = validateLinkSuggestionsQuery(req(qs), artistId) as NextResponse;
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: message });
  });
});
