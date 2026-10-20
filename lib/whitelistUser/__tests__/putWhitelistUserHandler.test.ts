import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, update } = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/whitelistUser/updateWhitelistedUser", () => ({ updateWhitelistedUser: update }));
const { putWhitelistUserHandler } = await import("@/lib/whitelistUser/putWhitelistUserHandler");

const req = (body: unknown) =>
  new Request("https://x/api/admin/whitelist-user/u1", {
    method: "PUT",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  update.mockReset();
});

describe("putWhitelistUserHandler", () => {
  it("updates the user", async () => {
    update.mockResolvedValueOnce({ status: "success", message: "User updated successfully" });
    const res = await putWhitelistUserHandler(req({ isHidden: true }), "u1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", message: "User updated successfully" });
    expect(update).toHaveBeenCalledWith("u1", { isHidden: true });
  });

  it("is a 400 when nothing changes", async () => {
    update.mockResolvedValueOnce({ status: "error", message: "No fields to update" });
    const res = await putWhitelistUserHandler(req({}), "u1");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "No fields to update" });
  });

  it("is a 400 when the update throws", async () => {
    update.mockRejectedValueOnce(new Error("taken"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const res = await putWhitelistUserHandler(req({ username: "x" }), "u1");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Error updating user" });
  });

  it("passes through the auth failure", async () => {
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await putWhitelistUserHandler(req({}), "u1")).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });
});
