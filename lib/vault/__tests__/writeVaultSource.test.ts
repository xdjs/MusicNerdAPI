import { describe, it, expect, vi, beforeEach } from "vitest";

const { record, queue } = vi.hoisted(() => ({
  record: vi.fn(async () => "activity-new"),
  queue: vi.fn(),
}));
vi.mock("@/lib/sourceExtraction/queueApprovedSourceExtraction", () => ({
  queueApprovedSourceExtraction: queue,
}));
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
  execute.mockReset().mockResolvedValue([]);
  record.mockClear();
  queue.mockClear();
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
    expect(queue).toHaveBeenCalledWith(writer, { id: "s1" }, "run-event");
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
    expect(queue).not.toHaveBeenCalled();
  });
});

it("keeps provider music classification before queueing the persisted approved source", async () => {
  const url = "https://music.apple.com/us/artist/example/1513734272";
  const source = { id: "s1", artistId: "a1", url, status: "approved", type: "music" };
  returning.mockResolvedValueOnce([source]);
  await withArtistOperation(
    "a1",
    { expectedClaimId: "c1", sourceOrigin: "research", activityId: "event" },
    () =>
      writeVaultSource(writer, { artistId: "a1", url, type: "article", status: "approved" }, url),
  );
  expect(values).toHaveBeenCalledWith(expect.objectContaining({ type: "music" }));
  expect(queue).toHaveBeenCalledWith(writer, source, "event");
});
it("does not insert or queue a research music destination rejected by the current provider identity", async () => {
  const url = "https://music.apple.com/us/artist/example/1513734272";
  execute.mockResolvedValueOnce([
    { artist_id: "another-artist", platform_id: "1513734272" },
  ] as never);
  expect(
    await withArtistOperation("a1", { expectedClaimId: "c1", sourceOrigin: "research" }, () =>
      writeVaultSource(writer, { artistId: "a1", url, status: "approved" }, url),
    ),
  ).toBeUndefined();
  expect(values).not.toHaveBeenCalled();
  expect(queue).not.toHaveBeenCalled();
  expect(record).not.toHaveBeenCalled();
});
