import { describe, expect, it } from "vitest";
import { verifyPkce } from "@/lib/oauth/verifyPkce";

// RFC 7636 appendix B.
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("verifyPkce", () => {
  it("accepts the verifier behind an S256 challenge", () => {
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it("refuses another verifier", () => {
    expect(verifyPkce(`${verifier.slice(0, -1)}A`, challenge)).toBe(false);
  });

  it("refuses the challenge itself sent as the verifier (plain)", () => {
    expect(verifyPkce(challenge, challenge)).toBe(false);
  });

  it.each([
    ["too short", "a".repeat(42)],
    ["too long", "a".repeat(129)],
    ["outside the allowed characters", `${"a".repeat(42)}+`],
  ])("refuses a verifier %s", (_label, v) => expect(verifyPkce(v, challenge)).toBe(false));
});
