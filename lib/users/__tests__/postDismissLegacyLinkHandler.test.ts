import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { auth, dismiss } = vi.hoisted(() => ({ auth: vi.fn(), dismiss: vi.fn() }));
vi.mock("@/lib/users/authenticateOwnAccount", () => ({ authenticateOwnAccount: auth }));
vi.mock("@/lib/users/dismissLegacyLink", () => ({ dismissLegacyLink: dismiss }));
const { postDismissLegacyLinkHandler } = await import("@/lib/users/postDismissLegacyLinkHandler");

const request = new Request("https://x/api/user/u1/dismiss-legacy-link", { method: "POST" });

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "u1" });
  dismiss.mockReset().mockResolvedValue(undefined);
});

describe("postDismissLegacyLinkHandler", () => {
  it("dismisses the caller's prompt", async () => {
    const res = await postDismissLegacyLinkHandler(request, "u1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(auth).toHaveBeenCalledWith(request, "u1");
    expect(dismiss).toHaveBeenCalledWith("u1");
  });

  it("forwards the auth response", async () => {
    const denied = NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
    auth.mockResolvedValue(denied);
    expect(await postDismissLegacyLinkHandler(request, "u1")).toBe(denied);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("is 500 on a database error", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    dismiss.mockRejectedValue(new Error("down"));
    const res = await postDismissLegacyLinkHandler(request, "u1");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
