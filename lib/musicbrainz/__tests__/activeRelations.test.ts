import { describe, it, expect } from "vitest";
import { activeRelations } from "@/lib/musicbrainz/activeRelations";

describe("activeRelations", () => {
  it("drops ended relations and rejects malformed ones", () => {
    expect(activeRelations({ relations: [{ ended: true }, { ended: false, a: 1 }] })).toEqual({
      status: "ok",
      relations: [{ ended: false, a: 1 }],
    });
    expect(activeRelations({ relations: [{ ended: "no" }] })).toEqual({ status: "invalid" });
    expect(activeRelations({})).toEqual({ status: "invalid" });
  });
});
