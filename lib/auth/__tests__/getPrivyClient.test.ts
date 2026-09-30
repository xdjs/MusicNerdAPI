import { describe, it, expect, vi, beforeEach } from "vitest";

const { PrivyClient } = vi.hoisted(() => ({ PrivyClient: vi.fn() }));
vi.mock("@privy-io/server-auth", () => ({ PrivyClient }));

beforeEach(() => {
  vi.resetModules();
  PrivyClient.mockReset();
  delete process.env.PRIVY_APP_ID;
  delete process.env.PRIVY_APP_SECRET;
});

describe("getPrivyClient", () => {
  it("builds one client from the app id and secret and reuses it", async () => {
    process.env.PRIVY_APP_ID = "app";
    process.env.PRIVY_APP_SECRET = "secret";
    const { getPrivyClient } = await import("@/lib/auth/getPrivyClient");
    const a = getPrivyClient();
    const b = getPrivyClient();
    expect(a).toBe(b);
    expect(PrivyClient).toHaveBeenCalledTimes(1);
    expect(PrivyClient).toHaveBeenCalledWith("app", "secret");
  });

  it("throws when Privy isn't configured", async () => {
    const { getPrivyClient } = await import("@/lib/auth/getPrivyClient");
    expect(() => getPrivyClient()).toThrow(/Privy is not configured/);
  });
});
