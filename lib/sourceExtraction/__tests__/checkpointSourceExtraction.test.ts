import { it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { checkpointSourceExtraction } from "@/lib/sourceExtraction/checkpointSourceExtraction";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
const m = vi.hoisted(() => ({ execute: vi.fn(), lock: vi.fn(), authorize: vi.fn() }));
const tx = { execute: m.execute };
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => fn(tx) },
}));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: m.lock }));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: m.authorize,
}));
const id = "11111111-1111-4111-8111-111111111111";
const state = {
  version: 1 as const,
  userId: id,
  expectedClaimId: null,
  sources: [{ id, url: "https://artist.example" }],
  outcomes: [],
};
const job = {
  id,
  artistId: id,
  kind: "source_extract" as const,
  status: "running" as const,
  cursor: 0,
  total: 1,
  attempts: 0,
  state,
  updatedAt: "2026-10-05T00:00:00Z",
  activityId: id,
};
const result = {
  status: "ready" as const,
  capturedAt: "2026-10-05T00:00:00.000Z",
  httpStatus: 200,
  truncated: false,
  text: "Original answer",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.execute
    .mockResolvedValueOnce([{ id }])
    .mockResolvedValueOnce([{ id }])
    .mockResolvedValue([{ id }]);
});
it("checkpoints the body, outcome and cursor together under the artist lock", async () => {
  expect(await checkpointSourceExtraction(job, state, result)).toMatchObject({ done: true });
  expect(m.lock).toHaveBeenCalledWith(tx, id);
  expect(m.authorize).toHaveBeenCalledWith(tx, id, { userId: id, expectedClaimId: null });
  const update = renderSql(m.execute.mock.calls[2][0]);
  expect(update.text).toContain("coalesce(extracted_text,'') ~ '^[[:space:]]*$'");
  expect(update.text).toContain("status='approved'");
  const progress = renderSql(m.execute.mock.calls[3][0]);
  expect(progress.text).toContain("claimed_at=null");
  expect(progress.params).toContain(1);
});
it("cannot write if the job has been cancelled or another slice advanced it", async () => {
  m.execute.mockReset().mockResolvedValue([]);
  expect(await checkpointSourceExtraction(job, state, result)).toMatchObject({ waiting: true });
  expect(m.execute).toHaveBeenCalledTimes(1);
});
it("rechecks authorization before writing fetched text", async () => {
  m.authorize.mockRejectedValue(new OwnershipChangedError());
  await expect(checkpointSourceExtraction(job, state, result)).rejects.toBeInstanceOf(
    OwnershipChangedError,
  );
  expect(m.execute).not.toHaveBeenCalled();
});
it("records skipped if approval, URL or original changed during fetch", async () => {
  m.execute
    .mockReset()
    .mockResolvedValueOnce([{ id }])
    .mockResolvedValueOnce([])
    .mockResolvedValue([{ id }]);
  await checkpointSourceExtraction(job, state, result);
  const q = renderSql(m.execute.mock.calls[2][0]);
  expect(q.params.some(p => typeof p === "string" && p.includes('"status":"skipped"'))).toBe(true);
});
it("records a blocked result without updating source text", async () => {
  await checkpointSourceExtraction(job, state, { ...result, status: "blocked", text: undefined });
  expect(
    m.execute.mock.calls.some(c => renderSql(c[0]).text.includes("update artist_vault_sources")),
  ).toBe(false);
});
it("propagates persistence failures rather than reporting success", async () => {
  m.execute.mockReset().mockResolvedValueOnce([{ id }]).mockRejectedValue(new Error("storage"));
  await expect(checkpointSourceExtraction(job, state, result)).rejects.toThrow("storage");
});
