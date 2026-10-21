import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/getPrivyClient", () => ({ getPrivyClient: () => ({ getUser }) }));
const { getPrivyUser } = await import("@/lib/auth/getPrivyUser");

beforeEach(() => {
  getUser.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getPrivyUser", () => {
  it("returns the Privy account", async () => {
    getUser.mockResolvedValueOnce({ id: "did:privy:1", linkedAccounts: [] });
    expect(await getPrivyUser("did:privy:1")).toEqual({ id: "did:privy:1", linkedAccounts: [] });
    expect(getUser).toHaveBeenCalledWith("did:privy:1");
  });

  it("is null when Privy fails", async () => {
    getUser.mockRejectedValueOnce(new Error("network"));
    expect(await getPrivyUser("did:privy:1")).toBeNull();
  });
});
