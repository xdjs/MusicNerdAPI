import { describe, it, expect } from "vitest";
import { FatalError } from "workflow";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { getActiveArtistOperation } from "@/lib/ownership/getActiveArtistOperation";

const { drainBuildStage } = await import("@/lib/claimBuild/drainBuildStage");

const ownership = { userId: "u1", expectedClaimId: "c1" };

describe("drainBuildStage", () => {
  it("runs every step of the stage inside the artist operation and returns its result", async () => {
    const seen: unknown[] = [];
    async function* stage() {
      seen.push(getActiveArtistOperation());
      yield { kind: "chat" as const, text: "one" };
      seen.push(getActiveArtistOperation());
      return 7;
    }
    await expect(drainBuildStage("a1", ownership, stage())).resolves.toBe(7);
    const operation = {
      userId: "u1",
      expectedClaimId: "c1",
      trigger: "onboarding",
      artistId: "a1",
    };
    expect(seen).toEqual([operation, operation]);
  });

  it("throws the stage's error event so the step retries", async () => {
    async function* stage() {
      yield { kind: "error" as const, message: "We couldn't write your About." };
    }
    await expect(drainBuildStage("a1", ownership, stage())).rejects.toThrow(
      "We couldn't write your About.",
    );
  });

  it("stops for good when the claim changed", async () => {
    async function* stage(): AsyncGenerator<never> {
      throw new OwnershipChangedError();
    }
    await expect(drainBuildStage("a1", ownership, stage())).rejects.toBeInstanceOf(FatalError);
  });

  it("passes any other failure through, to be retried", async () => {
    async function* stage(): AsyncGenerator<never> {
      throw new Error("timeout");
    }
    await expect(drainBuildStage("a1", ownership, stage())).rejects.toThrow("timeout");
  });
});
