import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ validate: vi.fn(), getDoc: vi.fn(), getCorrections: vi.fn() }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/lore/getArtistDoc", () => ({ getArtistDoc: mock.getDoc }));
vi.mock("@/lib/lore/getDocCorrections", () => ({ getDocCorrections: mock.getCorrections }));
const { getKnowledgeDocHandler } = await import("@/lib/knowledgeDoc/getKnowledgeDocHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const get = () =>
  getKnowledgeDocHandler(new Request(`https://api.test/api/artist/${id}/knowledge-doc`), id);

beforeEach(() => {
  vi.clearAllMocks();
  mock.validate.mockResolvedValue({ artistId: id, userId: "u1" });
});

describe("getKnowledgeDocHandler", () => {
  it("returns the document, its sources and the corrections", async () => {
    const sources = [{ id: 1, kind: "vault", label: "About", url: "https://x.test" }];
    const corrections = [{ id: "c1", claim: "A.", correction: null, kind: "wrong" }];
    mock.getDoc.mockResolvedValue({ content: "Doc [1].", sources });
    mock.getCorrections.mockResolvedValue(corrections);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ status: "ok", content: "Doc [1].", sources, corrections });
    expect(mock.getCorrections).toHaveBeenCalledWith(id);
  });

  it("returns null content and empty lists when there is no document", async () => {
    mock.getDoc.mockResolvedValue(undefined);
    expect(await (await get()).json()).toEqual({
      status: "ok",
      content: null,
      sources: [],
      corrections: [],
    });
    expect(mock.getCorrections).not.toHaveBeenCalled();
  });

  it("treats missing sources as an empty list", async () => {
    mock.getDoc.mockResolvedValue({ content: "Doc.", sources: null });
    mock.getCorrections.mockResolvedValue([]);
    expect((await (await get()).json()).sources).toEqual([]);
  });

  it("returns the auth response unchanged", async () => {
    const denied = NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403 },
    );
    mock.validate.mockResolvedValue(denied);
    expect(await get()).toBe(denied);
    expect(mock.getDoc).not.toHaveBeenCalled();
  });

  it("returns 500 when the read throws", async () => {
    mock.getDoc.mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Failed to load knowledge document",
    });
  });
});
