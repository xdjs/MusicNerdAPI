import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { putWhitelistUserHandler } from "@/lib/users/putWhitelistUserHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/users/updateWhitelistedUser", () => ({ updateWhitelistedUser: mock.update }));

const id = "9ac03b48-115a-489b-95db-d9ac15ada1b2";
const request = (body: string) =>
  new Request(`https://api.musicnerd.test/api/admin/whitelist-user/${id}`, { method: "PUT", body });

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("putWhitelistUserHandler", () => {
  it("updates the user and returns the message", async () => {
    mock.update.mockResolvedValueOnce({ status: "success", message: "User updated successfully" });
    const res = await putWhitelistUserHandler(
      request('{"isWhiteListed":true,"username":"newname"}'),
      id,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", message: "User updated successfully" });
    expect(mock.update).toHaveBeenCalledWith(id, { isWhiteListed: true, username: "newname" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns the update's refusal as a 400", async () => {
    mock.update.mockResolvedValueOnce({ status: "error", message: "No fields to update" });
    const res = await putWhitelistUserHandler(request("{}"), id);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "No fields to update" });
  });

  it("is 400 for a non-UUID id or a wrong-typed field, without updating", async () => {
    expect(
      (await putWhitelistUserHandler(request('{"isHidden":true}'), "test-user-id")).status,
    ).toBe(400);
    expect((await putWhitelistUserHandler(request('{"isHidden":"yes"}'), id)).status).toBe(400);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await putWhitelistUserHandler(request("{}"), id)).status).toBe(401);
  });

  it("answers an unexpected failure with MusicNerdWeb's 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.update.mockRejectedValueOnce(new Error("DB connection failed"));
    const res = await putWhitelistUserHandler(request('{"isWhiteListed":true}'), id);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
