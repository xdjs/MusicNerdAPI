import { describe, it, expect } from "vitest";
import { vaultFoundText } from "@/lib/onboarding/vaultFoundText";

describe("vaultFoundText", () => {
  it("vaultFoundText names what to add", () => {
    expect(vaultFoundText(2)).toBe(
      "We found 2 sources about you. Keep what's accurate, and add anything we missed — press, interviews, features, your own site. These feed your About and the answers your page gives fans.",
    );
    expect(vaultFoundText(1)).toMatch(/^We found 1 source about you\./);
  });
});
