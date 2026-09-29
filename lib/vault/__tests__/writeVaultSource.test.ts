import { describe, it, expect, vi, beforeEach } from "vitest";

const { record } = vi.hoisted(() => ({ record: vi.fn(async () => "activity-new") }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: record }));
const { writeVaultSource } = await import("@/lib/vault/writeVaultSource");
const { withArtistOperation } = await import("@/lib/ownership/withArtistOperation");

const values = vi.fn();
const returning = vi.fn();
const execute = vi.fn(async () => []);
const writer = { insert: () => ({ values }), execute } as never;

beforeEach(() => {
  returning.mockReset().mockResolvedValue([{ id: "s1" }]);
  values.mockReset().mockReturnValue({ onConflictDoNothing: () => ({ returning }) });
  execute.mockClear();
  record.mockClear();
});

describe("writeVaultSource", () => {
  it("uses the operation's origin and activity and records nothing new", async () => {
    const source = await withArtistOperation(
      "a1",
      { expectedClaimId: "c", activityId: "run-event", sourceOrigin: "research" },
      () => writeVaultSource(writer, { artistId: "a1", url: "u" }, "u"),
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ url: "u", origin: "research", activityId: "run-event" }),
    );
    expect(record).not.toHaveBeenCalled();
    expect(source).toEqual({ id: "s1", activityId: "run-event" });
  });

  it("records a user's addition as a submission, and a contextless one as added", async () => {
    await withArtistOperation(
      "a1",
      { expectedClaimId: null, userId: "u1", trigger: "vault_add" },
      () => writeVaultSource(writer, { artistId: "a1", url: "u" }, "u"),
    );
    expect(record).toHaveBeenLastCalledWith(
      "a1",
      "source_submission",
      { userId: "u1", sourceId: "s1", trigger: "vault_add" },
      writer,
    );
    await writeVaultSource(writer, { artistId: "a1", url: "u" }, "u");
    expect(record).toHaveBeenLastCalledWith(
      "a1",
      "source_added",
      { userId: undefined, sourceId: "s1", trigger: "editor_source" },
      writer,
    );
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("is undefined when the row already existed", async () => {
    returning.mockResolvedValueOnce([]);
    expect(await writeVaultSource(writer, { artistId: "a1", url: "u" }, "u")).toBeUndefined();
    expect(record).not.toHaveBeenCalled();
  });
});
