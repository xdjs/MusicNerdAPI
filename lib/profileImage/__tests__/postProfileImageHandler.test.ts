import { describe, it, expect } from "vitest";
import { postProfileImageHandler } from "@/lib/profileImage/postProfileImageHandler";

describe("postProfileImageHandler", () => {
  it("returns 501 with the expected error message", async () => {
    const request = new Request("http://x/api/artist/profile-image", { method: "POST" });
    const res = await postProfileImageHandler(request);
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Not implemented: requires Supabase Storage",
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
