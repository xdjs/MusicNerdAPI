import { describe, expect, it } from "vitest";
import { oauthErrorResponse } from "@/lib/oauth/oauthErrorResponse";

describe("oauthErrorResponse", () => {
  it("is the standard OAuth error shape, 400, uncached, with CORS", async () => {
    const res = oauthErrorResponse("invalid_grant", "The code is invalid");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "invalid_grant",
      error_description: "The code is invalid",
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("takes another status", () => {
    expect(oauthErrorResponse("server_error", "Internal server error", 500).status).toBe(500);
  });
});
