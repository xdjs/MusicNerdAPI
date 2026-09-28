import { describe, it, expect } from "vitest";
import { usernamesFrom } from "@/lib/instagram/usernamesFrom";

describe("usernamesFrom", () => {
  it("reads the username of each tagged user, skipping malformed entries", () => {
    expect(
      usernamesFrom([{ username: "a" }, { username: "" }, null, { id: 1 }, { username: "b" }]),
    ).toEqual(["a", "b"]);
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(usernamesFrom({ username: "a" })).toEqual([]);
  });
});
