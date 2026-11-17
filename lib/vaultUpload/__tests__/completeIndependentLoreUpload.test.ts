import { beforeEach, it, expect, vi } from "vitest";
import { completeIndependentLoreUpload } from "../completeIndependentLoreUpload";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { IndependentUploadTicket } from "../independentUploadTypes";
const m = vi.hoisted(() => ({ receipt: vi.fn(), download: vi.fn(), publish: vi.fn() }));
vi.mock("../independentUploadReceipt", () => ({ independentUploadReceipt: m.receipt }));
vi.mock("@/lib/storage/downloadObject", () => ({ downloadObject: m.download }));
vi.mock("../publishImmutableUpload", () => ({ publishImmutableUpload: m.publish }));
const ingest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/units/ingestUploadInline", () => ({ ingestUploadInline: ingest }));
const ticket: IndependentUploadTicket = {
  scope: "contribution",
  sourceId: "00000000-0000-4000-8000-000000000003",
  expectedClaimId: null,
  userId: "user",
  artistId: "artist",
  path: "artist/path",
  name: "a.txt",
  type: "text/plain",
  size: 4,
  expires: Date.now() + 60000,
};
beforeEach(() => {
  vi.resetAllMocks();
  ingest.mockResolvedValue(undefined);
  vi.stubEnv("SUPABASE_URL", "https://fixture.invalid");
  m.download.mockResolvedValue(Buffer.from("body"));
});
it("saves unclaimed trusted Lore and returns a receipt without private source data", async () => {
  m.receipt.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: ticket.sourceId });
  const response = await completeIndependentLoreUpload(ticket);
  expect(response.status).toBe(200);
  expect((await response.json()).source).toEqual({ id: ticket.sourceId });
  expect(m.publish).toHaveBeenCalledWith(ticket.path, Buffer.from("body"), "text/plain");
});
it("existing receipt returns without reading storage, requiring current trust or mutating moderation", async () => {
  m.receipt.mockResolvedValue({ id: ticket.sourceId });
  expect((await completeIndependentLoreUpload(ticket)).status).toBe(200);
  expect(m.download).not.toHaveBeenCalled();
  expect(m.publish).not.toHaveBeenCalled();
});
it("role loss during storage denies first insertion and preserves bytes", async () => {
  m.receipt.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new OwnershipChangedError());
  expect((await completeIndependentLoreUpload(ticket)).status).toBe(403);
});
it("reconciles a lost database acknowledgement from the durable receipt", async () => {
  m.receipt
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("lost acknowledgement"))
    .mockResolvedValueOnce({ id: ticket.sourceId });
  expect((await completeIndependentLoreUpload(ticket)).status).toBe(200);
});
it("never republishes a deleted source through an old ticket", async () => {
  m.receipt.mockRejectedValue(new Error("CONTRIBUTION_REMOVED"));
  expect((await completeIndependentLoreUpload(ticket)).status).toBe(410);
  expect(m.publish).not.toHaveBeenCalled();
});
it("leaves uncertain storage or database outcomes retryable without deleting objects", async () => {
  m.receipt.mockResolvedValue(undefined);
  m.publish.mockRejectedValue(new Error("storage unavailable"));
  const response = await completeIndependentLoreUpload(ticket);
  expect(response.status).toBe(503);
  expect((await response.json()).retryCompletion).toBe(true);
});
it("indexes the saved row after the receipt commits, with its id, artist, bytes and type", async () => {
  const order: string[] = [];
  m.receipt
    .mockResolvedValueOnce(undefined)
    .mockImplementationOnce(async () => (order.push("receipt"), { id: ticket.sourceId }));
  ingest.mockImplementation(async () => void order.push("ingest"));
  expect((await completeIndependentLoreUpload(ticket)).status).toBe(200);
  expect(order).toEqual(["receipt", "ingest"]);
  expect(ingest).toHaveBeenCalledWith({
    sourceId: ticket.sourceId,
    artistId: "artist",
    bytes: Buffer.from("body"),
    contentType: "text/plain",
  });
});
it("returns the same receipt response when ingestion finishes late", async () => {
  m.receipt.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: ticket.sourceId });
  ingest.mockImplementation(() => new Promise<void>(resolve => setTimeout(resolve, 20)));
  const response = await completeIndependentLoreUpload(ticket);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    receiptOnly: true,
    source: { id: ticket.sourceId },
  });
});
it("does not index when the receipt already existed", async () => {
  m.receipt.mockResolvedValue({ id: ticket.sourceId });
  await completeIndependentLoreUpload(ticket);
  expect(ingest).not.toHaveBeenCalled();
});
