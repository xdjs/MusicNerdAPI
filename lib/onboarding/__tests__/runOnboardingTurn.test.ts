import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";
import { getActiveArtistOperation } from "@/lib/ownership/getActiveArtistOperation";

const { inner, seen } = vi.hoisted(() => ({ inner: vi.fn(), seen: [] as unknown[] }));
vi.mock("@/lib/onboarding/runOnboardingTurnInternal", () => ({ runOnboardingTurnInternal: inner }));
const { runOnboardingTurn } = await import("@/lib/onboarding/runOnboardingTurn");

const ownership = { userId: "u1", expectedClaimId: "c1" };
const operation = { artistId: "a1", ...ownership, trigger: "onboarding" };

beforeEach(() => {
  seen.length = 0;
  inner.mockReset().mockImplementation(async function* () {
    seen.push(getActiveArtistOperation());
    yield { kind: "chat", text: "one" };
    // Work between yields (a write after the caller consumed an event) runs in the operation too.
    await new Promise(r => setTimeout(r, 0));
    seen.push(getActiveArtistOperation());
    yield { kind: "chat", text: "two" };
    seen.push(getActiveArtistOperation());
  });
});

describe("runOnboardingTurn", () => {
  it("runs every step of the turn inside the artist operation, and nothing outside it", async () => {
    const events = await collect(runOnboardingTurn("a1", { type: "open" }, ownership));
    expect(events).toEqual([
      { kind: "chat", text: "one" },
      { kind: "chat", text: "two" },
    ]);
    expect(seen).toEqual([operation, operation, operation]);
    expect(getActiveArtistOperation()).toBeUndefined();
    expect(inner).toHaveBeenCalledWith("a1", { type: "open" }, ownership);
  });

  it("closes the turn inside the operation when the caller stops early", async () => {
    const cleanup: unknown[] = [];
    inner.mockImplementationOnce(async function* () {
      try {
        yield { kind: "chat", text: "one" };
        yield { kind: "chat", text: "never" };
      } finally {
        cleanup.push(getActiveArtistOperation());
      }
    });
    for await (const e of runOnboardingTurn("a1", { type: "open" }, ownership)) {
      expect(e).toEqual({ kind: "chat", text: "one" });
      break;
    }
    expect(cleanup).toEqual([operation]);
  });
});
