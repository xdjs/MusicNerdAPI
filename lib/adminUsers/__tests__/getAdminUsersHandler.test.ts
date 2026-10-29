import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { getAdminUsersHandler } from "@/lib/adminUsers/getAdminUsersHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), search: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/adminUsers/searchUsers", () => ({ searchUsers: mock.search }));

const request = (query = "?search=dutch") =>
  new Request(`https://api.musicnerd.test/api/admin/users${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("getAdminUsersHandler", () => {
  it("returns the matching users", async () => {
    const users = [{ id: "u1", username: "dutchyyy", wallet: null }];
    mock.search.mockResolvedValueOnce(users);
    const res = await getAdminUsersHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", users });
    expect(mock.search).toHaveBeenCalledWith("dutch");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("lists every user without a search", async () => {
    mock.search.mockResolvedValueOnce([]);
    const res = await getAdminUsersHandler(request(""));
    expect(res.status).toBe(200);
    expect(mock.search).toHaveBeenCalledWith(undefined);
  });

  it("rejects a short search before reading users", async () => {
    const res = await getAdminUsersHandler(request("?search=ab"));
    expect(res.status).toBe(400);
    expect(mock.search).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await getAdminUsersHandler(request())).status).toBe(403);
    expect(mock.search).not.toHaveBeenCalled();
  });

  it("answers a database failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.search.mockRejectedValueOnce(new Error("db down"));
    const res = await getAdminUsersHandler(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
