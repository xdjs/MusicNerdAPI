import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

const { patchHeaderPositionHandler } = vi.hoisted(() => ({
  patchHeaderPositionHandler: vi.fn(async () => NextResponse.json({ status: "ok" })),
}));
vi.mock("@/lib/artistImages/patchHeaderPositionHandler", () => ({ patchHeaderPositionHandler }));
const route = await import("@/app/api/artist/header-position/route");

describe("/api/artist/header-position", () => {
  it("is dynamic", () => {
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("OPTIONS answers the preflight with CORS headers and no body", async () => {
    const response = await route.OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
    expect(await response.text()).toBe("");
  });

  it("PATCH delegates to its handler", async () => {
    const patch = new Request("https://api.test/api/artist/header-position", { method: "PATCH" });
    expect(await (await route.PATCH(patch)).json()).toEqual({ status: "ok" });
    expect(patchHeaderPositionHandler).toHaveBeenCalledWith(patch);
  });
});
