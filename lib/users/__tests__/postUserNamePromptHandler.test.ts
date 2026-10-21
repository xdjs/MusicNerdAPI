import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, record } = vi.hoisted(() => ({ auth: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/users/authenticateOwnAccount", () => ({ authenticateOwnAccount: auth }));
vi.mock("@/lib/users/recordUserNamePrompt", () => ({ recordUserNamePrompt: record }));
const { postUserNamePromptHandler } = await import("@/lib/users/postUserNamePromptHandler");

const request = new Request("https://x/api/user/u1/name-prompt", { method: "POST" });

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "u1" });
  record.mockReset();
});

describe("postUserNamePromptHandler", () => {
  it("answers whether to show the prompt", async () => {
    record.mockResolvedValue(true);
    const res = await postUserNamePromptHandler(request, "u1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", showPrompt: true });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(record).toHaveBeenCalledWith("u1");
  });

  it("forwards the auth response", async () => {
    const denied = NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
    auth.mockResolvedValue(denied);
    expect(await postUserNamePromptHandler(request, "u1")).toBe(denied);
    expect(record).not.toHaveBeenCalled();
  });

  it("is 503 when the database fails", async () => {
    record.mockRejectedValue(new Error("down"));
    const res = await postUserNamePromptHandler(request, "u1");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not load your user name setup.",
    });
  });
});
