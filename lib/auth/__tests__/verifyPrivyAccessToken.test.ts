import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyAuthToken } = vi.hoisted(() => ({ verifyAuthToken: vi.fn() }));
vi.mock("@/lib/auth/getPrivyClient", () => ({ getPrivyClient: () => ({ verifyAuthToken }) }));
const { verifyPrivyAccessToken } = await import("@/lib/auth/verifyPrivyAccessToken");

beforeEach(() => verifyAuthToken.mockReset());

describe("verifyPrivyAccessToken", () => {
  it("returns the Privy user id of a valid access token", async () => {
    verifyAuthToken.mockResolvedValueOnce({ userId: "did:privy:abc" });
    expect(await verifyPrivyAccessToken("tok")).toBe("did:privy:abc");
    expect(verifyAuthToken).toHaveBeenCalledWith("tok");
  });

  it("is null for an invalid or expired token", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    verifyAuthToken.mockImplementationOnce(async () => {
      throw new Error("jwt expired");
    });
    expect(await verifyPrivyAccessToken("tok")).toBeNull();
    error.mockRestore();
  });
});
