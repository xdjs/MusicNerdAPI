import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  exec: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: m.auth,
}));
vi.mock("@/lib/auth/getPrivyClient", () => ({
  getPrivyClient: () => ({ getUser: m.getUser }),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { postLinkWalletHandler } = await import("@/lib/user/postLinkWalletHandler");

const WALLET = "0x" + "a".repeat(40);
const req = (body: unknown) =>
  new Request("https://api/api/auth/link-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.exec.mockResolvedValue([]);
  m.getUser.mockResolvedValue({
    id: "did:privy:abc",
    linkedAccounts: [{ type: "wallet", address: WALLET }],
  });
});

describe("postLinkWalletHandler", () => {
  it("links a wallet when no legacy user exists", async () => {
    m.exec
      .mockResolvedValueOnce([{ privy_user_id: "did:privy:abc" }]) // user lookup
      .mockResolvedValueOnce([]) // legacy lookup
      .mockResolvedValueOnce([]); // update
    const res = await postLinkWalletHandler(req({ walletAddress: WALLET }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ merged: false });
  });

  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({ status: "error" }, { status: 401 }));
    const res = await postLinkWalletHandler(req({ walletAddress: WALLET }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid wallet address", async () => {
    const res = await postLinkWalletHandler(req({ walletAddress: "bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when wallet is not linked in Privy", async () => {
    m.exec.mockResolvedValueOnce([{ privy_user_id: "did:privy:abc" }]);
    m.getUser.mockResolvedValueOnce({
      id: "did:privy:abc",
      linkedAccounts: [{ type: "wallet", address: "0x" + "b".repeat(40) }],
    });
    const res = await postLinkWalletHandler(req({ walletAddress: WALLET }));
    expect(res.status).toBe(403);
  });
});
