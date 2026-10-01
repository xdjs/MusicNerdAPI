import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateAdvanceResearchBody } from "@/lib/research/validateAdvanceResearchBody";

const post = (body?: string) =>
  new Request("http://x/api/research/advance", { method: "POST", body });

describe("validateAdvanceResearchBody", () => {
  it("accepts an artist id", async () => {
    const id = "50f23458-df64-4381-8042-7333e8b64531";
    expect(await validateAdvanceResearchBody(post(JSON.stringify({ artistId: id })))).toEqual({
      artistId: id,
    });
  });

  it("treats an empty or unreadable body as no artist", async () => {
    expect(await validateAdvanceResearchBody(post())).toEqual({});
    expect(await validateAdvanceResearchBody(post("not json"))).toEqual({});
  });

  it("accepts the job kinds to claim", async () => {
    expect(
      await validateAdvanceResearchBody(post(JSON.stringify({ kinds: ["latest_refresh"] }))),
    ).toEqual({
      kinds: ["latest_refresh"],
    });
  });

  it("rejects a kind this API does not run, or an empty list, with a 400", async () => {
    for (const kinds of [["latest_refresh", "bogus"], []]) {
      const result = await validateAdvanceResearchBody(post(JSON.stringify({ kinds })));
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    }
  });

  it("rejects an artist id that is not a UUID with a 400", async () => {
    const result = await validateAdvanceResearchBody(post(JSON.stringify({ artistId: "abc" })));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ status: "error" });
  });
});
