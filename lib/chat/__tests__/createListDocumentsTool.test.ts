import { describe, expect, test, vi } from "vitest";
import { createChatDocuments } from "@/lib/chat/createChatDocuments";

const { listArtistDocuments } = vi.hoisted(() => ({ listArtistDocuments: vi.fn() }));
vi.mock("@/lib/units/listArtistDocuments", () => ({ listArtistDocuments }));
const { createListDocumentsTool } = await import("@/lib/chat/createListDocumentsTool");

const call = { toolCallId: "c", messages: [] } as never;

describe("createListDocumentsTool", () => {
  test("listDocuments marks sources without current units as indexing", async () => {
    listArtistDocuments.mockResolvedValue([
      {
        sourceKind: "vault",
        sourceId: "a",
        title: "Liner notes",
        url: "https://example.com/a",
        units: 3,
        indexing: false,
      },
      {
        sourceKind: "vault",
        sourceId: "b",
        title: "press.pdf",
        url: null,
        units: 0,
        indexing: true,
      },
      {
        sourceKind: "social",
        sourceId: "a",
        title: "Untitled",
        url: null,
        units: 1,
        indexing: false,
      },
    ]);
    let next = 4;
    const cite = vi.fn(() => next++);
    const documents = createChatDocuments(cite);
    documents.register({
      sourceKind: "vault",
      sourceId: "a",
      revision: "r1",
      title: "Liner notes",
      url: "https://example.com/a",
    });
    const tool = createListDocumentsTool("artist-1", documents);
    expect(await tool.execute!({}, call)).toEqual({
      documents: [
        {
          n: 4,
          title: "Liner notes",
          kind: "vault",
          url: "https://example.com/a",
          units: 3,
          indexing: false,
        },
        { n: null, title: "press.pdf", kind: "vault", url: null, units: 0, indexing: true },
        { n: null, title: "Untitled", kind: "social", url: null, units: 1, indexing: false },
      ],
    });
    expect(listArtistDocuments).toHaveBeenCalledWith("artist-1");
    // Listing numbers nothing: only search hands out document numbers.
    expect(cite).toHaveBeenCalledTimes(1);
    expect(tool.description).toContain("at most 60");
  });
});
