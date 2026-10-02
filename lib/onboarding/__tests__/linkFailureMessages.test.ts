import { describe, it, expect } from "vitest";
import { linkFailureMessages } from "@/lib/onboarding/linkFailureMessages";

const empty = {
  written: [],
  identityBlocked: [],
  unrecognized: [],
  writeRejected: [],
  routedToVaultApproved: [],
  routedToVaultPending: [],
  vaultInsertFailed: [],
};

describe("linkFailureMessages", () => {
  it("one chat line per failure bucket, in order, worded for whether the step is re-shown", () => {
    const events = linkFailureMessages(
      {
        ...empty,
        unrecognized: ["https://a"],
        writeRejected: ["https://b"],
        vaultInsertFailed: ["https://c"],
      },
      true,
    );
    expect(events.map(e => (e as { text: string }).text)).toEqual([
      expect.stringMatching(
        /^Heads up — I couldn't recognize one of your links: https:\/\/a\..*paste the profile URL/,
      ),
      expect.stringMatching(
        /^Heads up — I couldn't save one of your links: https:\/\/b\..*try a different link/,
      ),
      expect.stringMatching(
        /^Heads up — I couldn't save one of your links as a source for your About: https:\/\/c\./,
      ),
    ]);
    expect(linkFailureMessages({ ...empty, unrecognized: ["https://a"] }, false)[0]).toEqual({
      kind: "chat",
      text: expect.stringMatching(/Links section of your page\.$/),
    });
  });

  it("is empty when nothing failed", () => {
    expect(linkFailureMessages({ ...empty, routedToVaultApproved: ["https://x"] }, false)).toEqual(
      [],
    );
  });
});
