import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

const { authenticateRequest, resolve, list, sign } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  resolve: vi.fn(),
  list: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
vi.mock("@/lib/users/resolveProfileImageOwner", () => ({ resolveProfileImageOwner: resolve }));
vi.mock("@/lib/storage/listStorageObjects", () => ({ listStorageObjects: list }));
vi.mock("@/lib/storage/createSignedStorageUrl", () => ({ createSignedStorageUrl: sign }));
const { getUserProfileImageHandler } = await import("@/lib/users/getUserProfileImageHandler");

const request = new Request("https://x/api/user/profile-image");

beforeEach(() => {
  authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  resolve
    .mockReset()
    .mockResolvedValue({ owner: { id: "u1", privyUserId: "p" }, folder: "identity-h" });
  list.mockReset().mockResolvedValue([]);
  sign.mockReset().mockResolvedValue("https://s/storage/v1/object/sign/b/p?token=t");
  vi.spyOn(Date, "now").mockReturnValue(1760000000000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getUserProfileImageHandler", () => {
  it("signs the photo in the identity folder for an hour, with a cache buster, no-store", async () => {
    list.mockResolvedValueOnce([{ name: "avatar.webp" }]);
    const res = await getUserProfileImageHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      userId: "u1",
      url: "https://s/storage/v1/object/sign/b/p?token=t&v=1760000000000",
    });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(list).toHaveBeenCalledWith("user-profile-images", "identity-h", {
      limit: 1,
      search: "avatar.webp",
    });
    expect(sign).toHaveBeenCalledWith("user-profile-images", "identity-h/avatar.webp", 3600);
    expect(resolve).toHaveBeenCalledWith(request, "u1");
  });

  it("falls back to the id folder for photos stored before Privy", async () => {
    list.mockResolvedValueOnce([]).mockResolvedValueOnce([{ name: "avatar.webp" }]);
    await getUserProfileImageHandler(request);
    expect(list).toHaveBeenNthCalledWith(2, "user-profile-images", "u1", {
      limit: 1,
      search: "avatar.webp",
    });
    expect(sign).toHaveBeenCalledWith("user-profile-images", "u1/avatar.webp", 3600);
  });

  it("answers url null when neither folder has a photo", async () => {
    const res = await getUserProfileImageHandler(request);
    expect(await res.json()).toEqual({ status: "ok", userId: "u1", url: null });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(sign).not.toHaveBeenCalled();
  });

  it("checks the id folder once for a wallet-only account", async () => {
    resolve.mockResolvedValue({ owner: { id: "u1", privyUserId: null }, folder: "u1" });
    await getUserProfileImageHandler(request);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("forwards the 401 when not signed in", async () => {
    const denied = NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
    authenticateRequest.mockResolvedValue(denied);
    expect(await getUserProfileImageHandler(request)).toBe(denied);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("forwards the owner's 401 or 409", async () => {
    const changed = NextResponse.json({ status: "error", error: "x" }, { status: 409 });
    resolve.mockResolvedValue(changed);
    expect(await getUserProfileImageHandler(request)).toBe(changed);
  });

  it("is 503 when Storage or the database fails", async () => {
    list.mockRejectedValue(new Error("Storage list failed: HTTP 500"));
    const res = await getUserProfileImageHandler(request);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not load your profile photo",
    });
    resolve.mockRejectedValue(new Error("db down"));
    expect((await getUserProfileImageHandler(request)).status).toBe(503);
  });
});
