import { describe, expect, it } from "vitest";
import { readLookupBody } from "@/lib/artistLookups/readLookupBody";

const post = (body: string) => new Request("https://api.test/x", { method: "POST", body });

describe("readLookupBody", () => {
  it("returns a JSON object body", async () => {
    expect(await readLookupBody(post('{"spotifyID":"sp1"}'))).toEqual({ spotifyID: "sp1" });
  });

  it("returns an empty object for a body that is not a JSON object", async () => {
    expect(await readLookupBody(post("not json"))).toEqual({});
    expect(await readLookupBody(post("null"))).toEqual({});
    expect(await readLookupBody(post("[1]"))).toEqual({});
    expect(await readLookupBody(post(""))).toEqual({});
  });
});
