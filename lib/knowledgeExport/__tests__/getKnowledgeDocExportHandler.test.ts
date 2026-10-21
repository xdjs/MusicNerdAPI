import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  getArtistById: vi.fn(),
  getArtistDoc: vi.fn(),
}));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mock.getArtistById }));
vi.mock("@/lib/lore/getArtistDoc", () => ({ getArtistDoc: mock.getArtistDoc }));
const { getKnowledgeDocExportHandler } =
  await import("@/lib/knowledgeExport/getKnowledgeDocExportHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const get = (query = "") =>
  getKnowledgeDocExportHandler(
    new Request(`https://api.test/api/artist/${id}/knowledge-doc/export${query}`),
    id,
  );
const sources = [
  { id: 1, kind: "vault", label: 'The "About", page', url: "https://bioritmo.com/about" },
  { id: 2, kind: "interview", label: "Interview answer", url: null, publishedAt: null },
];

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z"), toFake: ["Date"] });
  vi.clearAllMocks();
  mock.validate.mockResolvedValue({ artistId: id, userId: "u1" });
  mock.getArtistById.mockResolvedValue({ id, name: "Bio Ritmo" });
  mock.getArtistDoc.mockResolvedValue({ content: "A salsa band [1].", sources });
});

describe("getKnowledgeDocExportHandler", () => {
  it("downloads the Lore as a dated Markdown file", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="bio-ritmo-2026-10-21.md"',
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Expose-Headers")).toBe("Content-Disposition");
    const text = await res.text();
    expect(text).toContain(
      "> Verified profile compiled by Music Nerd from 2 sources, exported 2026-10-21.",
    );
    expect(text).toContain("A salsa band [1].");
    expect(text).toContain('1. The "About", page — https://bioritmo.com/about');
  });

  it("downloads the sources as CSV with format=csv", async () => {
    const res = await get("?format=csv");
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="bio-ritmo-sources-2026-10-21.csv"',
    );
    expect(await res.text()).toBe(
      [
        "id,kind,label,url,published",
        '"1","vault","The ""About"", page","https://bioritmo.com/about",""',
        '"2","interview","Interview answer","",""',
      ].join("\n"),
    );
  });

  it("says 1 source, singular", async () => {
    mock.getArtistDoc.mockResolvedValue({ content: "Doc", sources: [sources[0]] });
    expect(await (await get()).text()).toContain("from 1 source, exported");
  });

  it("is a 404 without a document or an artist", async () => {
    mock.getArtistDoc.mockResolvedValue({ content: "", sources: [] });
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "No knowledge document yet" });
    mock.getArtistDoc.mockResolvedValue({ content: "Doc", sources });
    mock.getArtistById.mockResolvedValue(undefined);
    expect((await get()).status).toBe(404);
  });

  it("passes on the auth failure, and answers 500 when the export fails", async () => {
    mock.validate.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not your artist" }, { status: 403 }),
    );
    expect((await get()).status).toBe(403);
    mock.getArtistById.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Export failed" });
  });
});
