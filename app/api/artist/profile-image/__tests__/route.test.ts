import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

const { postProfileImageHandler } = vi.hoisted(() => ({
  postProfileImageHandler: vi.fn(async () => NextResponse.json({ status: "ok" })),
}));
vi.mock("@/lib/artistImages/postProfileImageHandler", () => ({ postProfileImageHandler }));
const route = await import("@/app/api/artist/profile-image/route");

describe("/api/artist/profile-image", () => {
  it("is dynamic", () => {
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("OPTIONS answers the preflight with CORS headers and no body", async () => {
    const response = await route.OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(await response.text()).toBe("");
  });

  it("POST delegates to its handler", async () => {
    const post = new Request("https://api.test/api/artist/profile-image", { method: "POST" });
    expect(await (await route.POST(post)).json()).toEqual({ status: "ok" });
    expect(postProfileImageHandler).toHaveBeenCalledWith(post);
  });
});
