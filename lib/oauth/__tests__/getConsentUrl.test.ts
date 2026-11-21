import { afterEach, describe, expect, it, vi } from "vitest";
import { getConsentUrl } from "@/lib/oauth/getConsentUrl";

afterEach(() => vi.unstubAllEnvs());

describe("getConsentUrl", () => {
  it("is OAUTH_CONSENT_URL", () => {
    vi.stubEnv("OAUTH_CONSENT_URL", "https://staging.musicnerd.net/oauth/authorize");
    expect(getConsentUrl()).toBe("https://staging.musicnerd.net/oauth/authorize");
  });

  it("throws when it is not set", () => {
    vi.stubEnv("OAUTH_CONSENT_URL", "");
    expect(() => getConsentUrl()).toThrow("OAUTH_CONSENT_URL");
  });
});
