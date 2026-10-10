import { describe, expect, it } from "vitest";
import { readLegacyBody } from "@/lib/legacyLookups/readLegacyBody";

const post = (body: string) => new Request("https://api.test/x", { method: "POST", body });

describe("readLegacyBody", () => {
  it("returns a JSON object body", async () => {
    expect(await readLegacyBody(post('{"spotifyID":"sp1"}'))).toEqual({ spotifyID: "sp1" });
  });

  it("returns an empty object for a body that is not a JSON object", async () => {
    expect(await readLegacyBody(post("not json"))).toEqual({});
    expect(await readLegacyBody(post("null"))).toEqual({});
    expect(await readLegacyBody(post("[1]"))).toEqual({});
    expect(await readLegacyBody(post(""))).toEqual({});
  });
});
