import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

const { getPhotoChoiceHandler, patchPhotoChoiceHandler } = vi.hoisted(() => ({
  getPhotoChoiceHandler: vi.fn(async () => NextResponse.json({ status: "ok", via: "get" })),
  patchPhotoChoiceHandler: vi.fn(async () => NextResponse.json({ status: "ok", via: "patch" })),
}));
vi.mock("@/lib/artistImages/getPhotoChoiceHandler", () => ({ getPhotoChoiceHandler }));
vi.mock("@/lib/artistImages/patchPhotoChoiceHandler", () => ({ patchPhotoChoiceHandler }));
const route = await import("@/app/api/artist/photo-choice/route");

describe("/api/artist/photo-choice", () => {
  it("is dynamic with Web's 30 second budget", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.maxDuration).toBe(30);
  });

  it("OPTIONS answers the preflight with CORS headers and no body", async () => {
    const response = await route.OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
    expect(await response.text()).toBe("");
  });

  it("GET and PATCH delegate to their handlers", async () => {
    const get = new Request("https://api.test/api/artist/photo-choice?artistId=x");
    expect(await (await route.GET(get)).json()).toEqual({ status: "ok", via: "get" });
    expect(getPhotoChoiceHandler).toHaveBeenCalledWith(get);
    const patch = new Request("https://api.test/api/artist/photo-choice", { method: "PATCH" });
    expect(await (await route.PATCH(patch)).json()).toEqual({ status: "ok", via: "patch" });
    expect(patchPhotoChoiceHandler).toHaveBeenCalledWith(patch);
  });
});
