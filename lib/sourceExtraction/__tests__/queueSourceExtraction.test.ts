import { it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { queueSourceExtraction } from "@/lib/sourceExtraction/queueSourceExtraction";
const m = vi.hoisted(() => ({
  execute: vi.fn(),
  lock: vi.fn(),
  ownership: vi.fn(),
  record: vi.fn(),
}));
const tx = { execute: m.execute };
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => fn(tx) },
}));
vi.mock("@/lib/ownership/lockScopedArtistWrite", () => ({ lockScopedArtistWrite: m.lock }));
vi.mock("@/lib/ownership/getArtistOperationOwnership", () => ({
  getArtistOperationOwnership: m.ownership,
}));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.record }));
const id = "11111111-1111-4111-8111-111111111111";
const row = {
  id,
  url: "https://artist.example/interview",
  status: "approved",
  file_path: null,
  extracted_text: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  m.ownership.mockReturnValue({ userId: id, expectedClaimId: null });
  m.record.mockResolvedValue(id);
  m.execute.mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValue([{ id }]);
});
it("queues an explicitly attributed bounded job after authorization", async () => {
  expect(await queueSourceExtraction(id, [id])).toEqual({ status: "ok", jobId: id, queued: 1 });
  expect(m.lock).toHaveBeenCalledWith(tx, id);
  const q = renderSql(m.execute.mock.calls[2][0]);
  expect(q.text).toContain("insert into artist_research_jobs");
  expect(q.params.some(p => typeof p === "string" && p.includes('"userId"'))).toBe(true);
});
it("never runs outside an authenticated operation", async () => {
  m.ownership.mockReturnValue(undefined);
  await expect(queueSourceExtraction(id, [id])).rejects.toMatchObject({ status: 403 });
  expect(m.execute).not.toHaveBeenCalled();
});
it.each([
  { ...row, status: "pending" },
  { ...row, file_path: "private/file.pdf" },
  { ...row, url: "http://127.0.0.1/" },
])("rejects ineligible selection", async source => {
  m.execute.mockReset().mockResolvedValue([source]);
  await expect(queueSourceExtraction(id, [id])).rejects.toMatchObject({ status: 400 });
  expect(m.record).not.toHaveBeenCalled();
});
it("does not silently accept IDs from another artist", async () => {
  m.execute.mockReset().mockResolvedValue([]);
  await expect(queueSourceExtraction(id, [id])).rejects.toMatchObject({ status: 400 });
});
it("does not overwrite an existing original or create a pointless job", async () => {
  m.execute.mockReset().mockResolvedValue([{ ...row, extracted_text: "Original" }]);
  expect(await queueSourceExtraction(id, [id])).toEqual({ status: "ok", jobId: null, queued: 0 });
  expect(m.record).not.toHaveBeenCalled();
});
it("reports an existing live extraction instead of duplicating it", async () => {
  m.execute.mockReset().mockResolvedValueOnce([row]).mockResolvedValueOnce([{ id }]);
  await expect(queueSourceExtraction(id, [id])).rejects.toMatchObject({ status: 409 });
});
it("propagates database failures for the handler to report unavailable", async () => {
  m.execute.mockReset().mockRejectedValue(new Error("database"));
  await expect(queueSourceExtraction(id, [id])).rejects.toThrow("database");
});
