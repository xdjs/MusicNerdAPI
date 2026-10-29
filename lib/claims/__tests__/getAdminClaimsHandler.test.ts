import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getAdminClaimsHandler } from "@/lib/claims/getAdminClaimsHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/claims/listAdminClaims", () => ({ listAdminClaims: mock.list }));

const request = () => new Request("https://api.musicnerd.test/api/admin/claims");

beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("getAdminClaimsHandler", () => {
  it("returns the claims", async () => {
    const claims = [{ id: "c1", status: "pending" }];
    mock.list.mockResolvedValueOnce(claims);
    const res = await getAdminClaimsHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", claims });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await getAdminClaimsHandler(request())).status).toBe(403);
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("answers a database failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.list.mockRejectedValueOnce(new Error("db down"));
    const res = await getAdminClaimsHandler(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
