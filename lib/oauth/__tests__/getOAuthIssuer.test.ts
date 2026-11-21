import { describe, expect, it } from "vitest";
import { getOAuthIssuer } from "@/lib/oauth/getOAuthIssuer";

describe("getOAuthIssuer", () => {
  it("is /api/oauth on the origin", () => {
    expect(getOAuthIssuer("https://api.musicnerd.net")).toBe("https://api.musicnerd.net/api/oauth");
  });
});
