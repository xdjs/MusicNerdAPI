import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getUserById: vi.fn(),
  getPrivyUser: vi.fn(),
  getUserByWallet: vi.fn(),
  mergeAccounts: vi.fn(),
  linkWalletToUser: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: mock.authenticateRequest,
}));
vi.mock("@/lib/account/getUserById", () => ({ getUserById: mock.getUserById }));
vi.mock("@/lib/auth/getPrivyUser", () => ({ getPrivyUser: mock.getPrivyUser }));
vi.mock("@/lib/account/getUserByWallet", () => ({ getUserByWallet: mock.getUserByWallet }));
vi.mock("@/lib/account/mergeAccounts", () => ({ mergeAccounts: mock.mergeAccounts }));
vi.mock("@/lib/account/linkWalletToUser", () => ({ linkWalletToUser: mock.linkWalletToUser }));
const { postLinkWalletHandler } = await import("@/lib/account/postLinkWalletHandler");

const wallet = "0x1234567890abcdef1234567890abcdef12345678";
const request = (body: unknown = { walletAddress: wallet.toUpperCase().replace("0X", "0x") }) =>
  new Request("https://api.musicnerd.test/api/auth/link-wallet", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  for (const fn of Object.values(mock)) fn.mockReset();
  mock.authenticateRequest.mockResolvedValue({ userId: "u1" });
  mock.getUserById.mockResolvedValue({ id: "u1", privyUserId: "did:privy:u1" });
  mock.getPrivyUser.mockResolvedValue({
    id: "did:privy:u1",
    linkedAccounts: [
      { type: "wallet", address: wallet },
      { type: "email", address: "someone@example.test" },
    ],
  });
  mock.getUserByWallet.mockResolvedValue(undefined);
  mock.mergeAccounts.mockResolvedValue({ success: true });
  mock.linkWalletToUser.mockResolvedValue({ id: "u1", wallet });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("postLinkWalletHandler", () => {
  it("forwards the auth error when not signed in", async () => {
    mock.authenticateRequest.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(401);
    expect(mock.getPrivyUser).not.toHaveBeenCalled();
  });

  it("refuses an account without a Privy identity", async () => {
    mock.getUserById.mockResolvedValue({ id: "u1", privyUserId: null });
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ status: "error", error: "Not authenticated" });
  });

  it("rejects a bad body before touching Privy", async () => {
    expect((await postLinkWalletHandler(request("{"))).status).toBe(400);
    expect((await postLinkWalletHandler(request({ walletAddress: "0x1" }))).status).toBe(400);
    expect(mock.getPrivyUser).not.toHaveBeenCalled();
  });

  it("fails closed when Privy is unavailable", async () => {
    mock.getPrivyUser.mockResolvedValue(null);
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Wallet verification unavailable. Please try again.",
    });
    expect(mock.getUserByWallet).not.toHaveBeenCalled();
  });

  it("rejects an unverified wallet or a different Privy identity before any lookup or merge", async () => {
    mock.getPrivyUser.mockResolvedValueOnce({ id: "did:privy:u1", linkedAccounts: [] });
    expect((await postLinkWalletHandler(request())).status).toBe(403);
    mock.getPrivyUser.mockResolvedValueOnce({
      id: "did:privy:someone-else",
      linkedAccounts: [{ type: "wallet", address: wallet }],
    });
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Wallet is not linked to your authenticated account.",
    });
    expect(mock.getUserByWallet).not.toHaveBeenCalled();
    expect(mock.mergeAccounts).not.toHaveBeenCalled();
  });

  it("links the wallet to the current account when no legacy account has it", async () => {
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      success: true,
      merged: false,
      message: "Wallet linked successfully!",
    });
    expect(mock.getUserByWallet).toHaveBeenCalledWith(wallet);
    expect(mock.linkWalletToUser).toHaveBeenCalledWith("u1", wallet);
    expect(mock.mergeAccounts).not.toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("merges into a legacy account that has the wallet", async () => {
    mock.getUserByWallet.mockResolvedValue({ id: "legacy", privyUserId: null });
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      success: true,
      merged: true,
      userId: "legacy",
      message: "Account merged successfully! Your contribution history has been restored.",
    });
    expect(mock.mergeAccounts).toHaveBeenCalledWith("u1", "legacy");
    expect(mock.linkWalletToUser).not.toHaveBeenCalled();
  });

  it("refuses a wallet whose legacy account already has another Privy identity", async () => {
    mock.getUserByWallet.mockResolvedValue({ id: "legacy", privyUserId: "did:privy:other" });
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      status: "error",
      error: "This wallet is already linked to another account",
    });
    expect(mock.mergeAccounts).not.toHaveBeenCalled();
  });

  it("reports a failed merge with its reason", async () => {
    mock.getUserByWallet.mockResolvedValue({ id: "legacy", privyUserId: null });
    mock.mergeAccounts.mockResolvedValue({ success: false, error: "User not found" });
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "User not found" });
  });

  it("returns the JSON 500 with CORS when the auth lookup throws", async () => {
    mock.authenticateRequest.mockRejectedValue(new Error("db pool exhausted"));
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(500);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "error", error: "Failed to link wallet" });
  });

  it("hides an unexpected failure", async () => {
    mock.getUserByWallet.mockRejectedValue(new Error("private connection error"));
    const res = await postLinkWalletHandler(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to link wallet" });
  });
});
