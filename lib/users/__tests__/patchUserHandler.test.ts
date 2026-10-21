import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, setUserName } = vi.hoisted(() => ({ auth: vi.fn(), setUserName: vi.fn() }));
vi.mock("@/lib/users/authenticateOwnAccount", () => ({ authenticateOwnAccount: auth }));
vi.mock("@/lib/users/setUserName", () => ({ setUserName }));
const { patchUserHandler } = await import("@/lib/users/patchUserHandler");

const patch = (body: string) =>
  new Request("https://x/api/user/u1", {
    method: "PATCH",
    body,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "u1" });
  setUserName
    .mockReset()
    .mockResolvedValue({ username: "Vinyl Otter", usernameNeedsConfirmation: false });
});

describe("patchUserHandler", () => {
  it("saves the trimmed name and answers status ok with Web's message", async () => {
    const res = await patchUserHandler(patch(JSON.stringify({ username: " Vinyl Otter " })), "u1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", message: "User name updated" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(setUserName).toHaveBeenCalledWith("u1", "Vinyl Otter");
  });

  it("forwards the auth response", async () => {
    const denied = NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
    auth.mockResolvedValue(denied);
    expect(await patchUserHandler(patch("{}"), "u1")).toBe(denied);
  });

  it("is 400 for a body that is not JSON", async () => {
    const res = await patchUserHandler(patch("{nope"), "u1");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid request body" });
    expect(setUserName).not.toHaveBeenCalled();
  });

  it.each([
    [JSON.stringify({ username: "" }), "User name is required."],
    [JSON.stringify({}), "User name is required."],
    [JSON.stringify({ username: "a".repeat(51) }), "User name must be 50 characters or less."],
    [
      JSON.stringify({ username: "someone@example.com" }),
      "Choose a user name instead of an email or wallet address.",
    ],
  ])("is 400 with the validation message for %s", async (body, message) => {
    const res = await patchUserHandler(patch(body), "u1");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: message });
    expect(setUserName).not.toHaveBeenCalled();
  });

  it("is 409 when the name is taken", async () => {
    setUserName.mockRejectedValue(new Error("That user name is already taken. Try another."));
    const res = await patchUserHandler(patch(JSON.stringify({ username: "Vinyl Otter" })), "u1");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      status: "error",
      error: "That user name is already taken. Try another.",
    });
  });

  it("is 400 when the name is the account's wallet", async () => {
    setUserName.mockRejectedValue(
      new Error("Choose a user name instead of an email or wallet address."),
    );
    const res = await patchUserHandler(patch(JSON.stringify({ username: "solanawallet" })), "u1");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Choose a user name instead of an email or wallet address.",
    });
  });

  it("is 500 on any other error", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    setUserName.mockRejectedValue(new Error("Account not found."));
    const res = await patchUserHandler(patch(JSON.stringify({ username: "Vinyl Otter" })), "u1");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
