import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { insert: (...a: unknown[]) => insert(...a) } }));
const { recordArtistActivity } = await import("@/lib/activity/recordArtistActivity");
const { withArtistOperation } = await import("@/lib/ownership/withArtistOperation");

const values = vi.fn();
beforeEach(() => {
  insert.mockReset();
  values.mockReset().mockReturnValue({ returning: async () => [{ id: "event" }] });
  insert.mockReturnValue({ values });
});

describe("recordArtistActivity", () => {
  it("uses the initiating operation's user and trigger", async () => {
    const id = await withArtistOperation(
      "a1",
      { userId: "initiator", expectedClaimId: null, trigger: "onboarding", activityId: "parent" },
      () => recordArtistActivity("a1", "source_search"),
    );
    expect(id).toBe("event");
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: "a1",
        action: "source_search",
        actorUserId: "initiator",
        actorKind: "user",
        trigger: "onboarding",
        parentActivityId: "parent",
      }),
    );
  });

  it("does not invent a user when there is no context", async () => {
    await recordArtistActivity("a1", "source_added", { sourceId: "s1" });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
        actorKind: "unknown",
        trigger: "unrecorded",
        sourceId: "s1",
        parentActivityId: null,
      }),
    );
  });

  it("writes with the caller's transaction when given one", async () => {
    const txValues = vi.fn().mockReturnValue({ returning: async () => [{ id: "tx-event" }] });
    const tx = { insert: vi.fn().mockReturnValue({ values: txValues }) };
    expect(await recordArtistActivity("a1", "source_added", {}, tx as never)).toBe("tx-event");
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails rather than letting unrecorded research continue", async () => {
    insert.mockImplementationOnce(() => {
      throw new Error("audit unavailable");
    });
    await expect(recordArtistActivity("a1", "source_search")).rejects.toThrow("audit unavailable");
    values.mockReturnValueOnce({ returning: async () => [] });
    await expect(recordArtistActivity("a1", "source_search")).rejects.toThrow(
      "Could not record artist activity",
    );
  });
});
