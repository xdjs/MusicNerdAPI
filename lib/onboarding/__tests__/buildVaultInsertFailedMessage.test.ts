import { describe, it, expect } from "vitest";
import { buildVaultInsertFailedMessage } from "@/lib/onboarding/buildVaultInsertFailedMessage";

describe("buildVaultInsertFailedMessage", () => {
  it("buildVaultInsertFailedMessage reports a database failure, not an unrecognised link", () => {
    expect(buildVaultInsertFailedMessage(["https://a.com"])).toBe(
      "Heads up — I couldn't save one of your links as a source for your About: https://a.com. Try again in a moment, or add it later from your Lore.",
    );
  });
});
