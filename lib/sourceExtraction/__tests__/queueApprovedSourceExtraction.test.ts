import { it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { queueApprovedSourceExtraction } from "@/lib/sourceExtraction/queueApprovedSourceExtraction";
const execute = vi.fn();
const writer = { execute } as never;
const id = "11111111-1111-4111-8111-111111111111";
const source = { id, artistId: id, url: "https://artist.example/interview", status: "approved" };
beforeEach(() => execute.mockReset().mockResolvedValue([]));
it.each([
  { ...source, status: "pending" },
  { ...source, status: "rejected" },
  { ...source, extractedText: "An original" },
  { ...source, filePath: "private/upload.pdf" },
  { ...source, url: "file:///private/file" },
  { ...source, url: "http://127.0.0.1/" },
  { ...source, url: "https://artist.example:8443/" },
  { ...source, url: "https://user:secret@artist.example/" },
])("does not queue an ineligible source", async row => {
  await queueApprovedSourceExtraction(writer, row, null);
  expect(execute).not.toHaveBeenCalled();
});
it("creates a one-source bounded job with the mutation activity and approved claim generation", async () => {
  execute.mockResolvedValueOnce([{ id }]);
  await queueApprovedSourceExtraction(writer, source, id);
  const insert = renderSql(execute.mock.calls[2][0]);
  expect(insert.text).toContain("on conflict do nothing");
  const state = insert.params.find(
    p => typeof p === "string" && p.includes('"version":2'),
  ) as string;
  expect(JSON.parse(state)).toEqual({
    version: 2,
    autoSourceId: id,
    expectedClaimId: id,
    sources: [{ id, url: source.url }],
    outcomes: [],
  });
  expect(insert.params).toContain(id);
});
it("captures no-claim generation without inventing a user and propagates queue failures", async () => {
  await queueApprovedSourceExtraction(writer, source, null);
  const insert = renderSql(execute.mock.calls[2][0]);
  expect(
    insert.params.some(p => typeof p === "string" && p.includes('"expectedClaimId":null')),
  ).toBe(true);
  execute.mockRejectedValueOnce(new Error("queue unavailable"));
  await expect(queueApprovedSourceExtraction(writer, source, null)).rejects.toThrow(
    "Source extraction queue unavailable",
  );
});
