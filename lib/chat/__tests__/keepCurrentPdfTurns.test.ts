import { beforeEach, expect, it, vi } from "vitest";

const loadChatPdfs = vi.fn();
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({
  loadChatPdfs: (...a: unknown[]) => loadChatPdfs(...a),
}));
const { keepCurrentPdfTurns } = await import("@/lib/chat/keepCurrentPdfTurns");

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const text = (t: string) => [{ type: "text" as const, text: t }];
const messages = () => [
  { id: "1", role: "user" as const, parts: text("What names?") },
  {
    id: "2",
    role: "assistant" as const,
    parts: text("Dutchy [1, p.1]."),
    pdfReads: [{ sourceId: A, revision: "a1" }],
  },
  { id: "3", role: "user" as const, parts: text("And labels?") },
  { id: "4", role: "assistant" as const, parts: text("Night Label [1].") },
  {
    id: "5",
    role: "assistant" as const,
    parts: text("Two documents [1][2]."),
    pdfReads: [
      { sourceId: A, revision: "a1" },
      { sourceId: B, revision: "b1" },
    ],
  },
  { id: "6", role: "user" as const, parts: text("Which is the producer alias?") },
];

beforeEach(() => loadChatPdfs.mockReset());

it("keeps PDF answers whose documents are still published at the revision they read, and strips the bookkeeping", async () => {
  loadChatPdfs.mockImplementation(async (_artist: string, id: string) => [
    { id, revision: id === A ? "a1" : "b1" },
  ]);
  const kept = await keepCurrentPdfTurns(messages(), "artist");
  expect(kept.map(m => m.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
  expect(kept.every(m => !("pdfReads" in m))).toBe(true);
  // One lookup per document, not per message.
  expect(loadChatPdfs).toHaveBeenCalledTimes(2);
  expect(loadChatPdfs).toHaveBeenCalledWith("artist", A);
});

it("drops an answer whose document changed or was withdrawn, and only that answer", async () => {
  loadChatPdfs.mockImplementation(async (_artist: string, id: string) =>
    id === A ? [{ id, revision: "a2" }] : [],
  );
  const kept = await keepCurrentPdfTurns(messages(), "artist");
  expect(kept.map(m => m.id)).toEqual(["1", "3", "4", "6"]);
  expect(JSON.stringify(kept)).not.toContain("Dutchy [1, p.1].");
});

it("asks nothing of the database for a conversation without PDF answers", async () => {
  const plain = messages().filter(m => !("pdfReads" in m));
  expect(await keepCurrentPdfTurns(plain, "artist")).toEqual(plain);
  expect(loadChatPdfs).not.toHaveBeenCalled();
});
