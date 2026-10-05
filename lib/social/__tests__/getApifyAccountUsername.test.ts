import { afterEach, describe, expect, it, vi } from "vitest";
import { getApifyAccountUsername } from "@/lib/social/getApifyAccountUsername";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("private Apify account verification", () => {
  it("returns only the username and keeps the token out of the URL", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "private-token");
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { username: "xdjs", email: "private", token: "private" } }),
    });
    vi.stubGlobal("fetch", request);
    expect(await getApifyAccountUsername()).toBe("xdjs");
    expect(request.mock.calls[0][0]).toBe("https://api.apify.com/v2/users/me");
    expect(request.mock.calls[0][1].headers.Authorization).toBe("Bearer private-token");
  });
  it("returns null for unavailable credentials or failed reads", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(await getApifyAccountUsername()).toBeNull();
    expect(request).not.toHaveBeenCalled();
    vi.stubEnv("APIFY_API_TOKEN", "private-token");
    request.mockRejectedValue(new Error("private-token"));
    expect(await getApifyAccountUsername()).toBeNull();
    request.mockResolvedValue({ ok: false });
    expect(await getApifyAccountUsername()).toBeNull();
  });
});
