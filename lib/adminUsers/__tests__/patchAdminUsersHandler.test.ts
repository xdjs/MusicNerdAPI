import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { patchAdminUsersHandler } from "@/lib/adminUsers/patchAdminUsersHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), set: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/adminUsers/setUserRole", () => ({ setUserRole: mock.set }));

const id = "0b1e4c2a-7f3d-4a58-9c61-2d8e5f7a9b10";
const request = (body: unknown) =>
  new Request("https://api.musicnerd.test/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("patchAdminUsersHandler", () => {
  it("changes the role and returns the count", async () => {
    mock.set.mockResolvedValueOnce(1);
    const res = await patchAdminUsersHandler(
      request({ userIds: [id], role: "admin", enabled: true }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", updated: 1 });
    expect(mock.set).toHaveBeenCalledWith([id], "admin", true);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects an invalid body before writing", async () => {
    const res = await patchAdminUsersHandler(request({ userIds: [id], role: "admin" }));
    expect(res.status).toBe(400);
    expect(mock.set).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const res = await patchAdminUsersHandler(
      request({ userIds: [id], role: "admin", enabled: true }),
    );
    expect(res.status).toBe(401);
    expect(mock.set).not.toHaveBeenCalled();
  });

  it("answers a database failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.set.mockRejectedValueOnce(new Error("db down"));
    const res = await patchAdminUsersHandler(
      request({ userIds: [id], role: "hidden", enabled: true }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
