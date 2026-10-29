import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getAdminContributionsHandler } from "@/lib/adminContributions/getAdminContributionsHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/adminContributions/getAdminContributions", () => ({
  getAdminContributions: mock.list,
}));
vi.mock("@/lib/users/getUserById", () => ({ getUserById: mock.user }));

const user = "00000000-0000-4000-8000-000000000010";
const request = (query = "") =>
  new Request(`https://api.musicnerd.test/api/admin/contributions${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
  mock.list.mockResolvedValue({ items: [], total: 0 });
});

describe("getAdminContributionsHandler", () => {
  it("returns everyone's pending contributions with no account", async () => {
    const res = await getAdminContributionsHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", items: [], total: 0, account: null });
    expect(mock.list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "", status: "pending" }),
    );
    expect(mock.user).not.toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns one contributor's, with their account", async () => {
    mock.user.mockResolvedValueOnce({
      id: user,
      username: "salsero",
      email: "fan@example.com",
      isAdmin: false,
    });
    const res = await getAdminContributionsHandler(request(`?userId=${user}`));
    expect(await res.json()).toEqual({
      status: "ok",
      items: [],
      total: 0,
      account: { id: user, username: "salsero", email: "fan@example.com" },
    });
    expect(mock.list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user, status: "all" }),
    );
  });

  it("answers 404 for a contributor who doesn't exist", async () => {
    mock.user.mockResolvedValueOnce(undefined);
    const res = await getAdminContributionsHandler(request(`?userId=${user}`));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "User not found" });
  });

  it("answers 400 for a bad userId", async () => {
    expect((await getAdminContributionsHandler(request("?userId=x"))).status).toBe(400);
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await getAdminContributionsHandler(request())).status).toBe(403);
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("answers a database failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.list.mockRejectedValueOnce(new Error("db down"));
    expect((await getAdminContributionsHandler(request())).status).toBe(500);
  });
});
