import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const mock = vi.hoisted(() => ({
  edit: vi.fn(),
  claim: vi.fn(),
  urls: vi.fn(),
  preview: vi.fn(),
  insert: vi.fn(),
  enrich: vi.fn(),
  queue: vi.fn(),
}));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({ validateArtistEditRequest: mock.edit }));
vi.mock("@/lib/ownership/getLoreClaimGeneration", () => ({ getLoreClaimGeneration: mock.claim }));
vi.mock("@/lib/vault/getVaultSourceUrlsByArtistId", () => ({
  getVaultSourceUrlsByArtistId: mock.urls,
}));
vi.mock("@/lib/pages/fetchLinkPreview", () => ({ fetchLinkPreview: mock.preview }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: mock.insert }));
vi.mock("@/lib/onboarding/enrichVaultSource", () => ({ enrichVaultSource: mock.enrich }));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: mock.queue }));
const { postVaultSourceHandler } = await import("@/lib/vaultSources/postVaultSourceHandler");

const artistId = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const call = (body: unknown) =>
  postVaultSourceHandler(
    new Request("https://api.test/x", { method: "POST", body: JSON.stringify(body) }),
    artistId,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mock.edit.mockResolvedValue({ artistId, userId: "u1" });
  mock.claim.mockResolvedValue("c1");
  mock.urls.mockResolvedValue([]);
  mock.preview.mockResolvedValue({ title: null, imageUrl: null });
  mock.insert.mockImplementation(async (data: object) => ({ id: "s1", ...data }));
  mock.queue.mockResolvedValue(true);
});

describe("postVaultSourceHandler", () => {
  it("saves a pending source attributed to the editor, under the claim read first", async () => {
    const res = await call({ url: "pitchfork.com/reviews/x" });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toMatchObject({ status: "ok", source: { id: "s1", status: "pending" } });
    expect(json.warning).toBeUndefined();
    expect(mock.insert).toHaveBeenCalledWith(
      {
        artistId,
        url: "https://pitchfork.com/reviews/x",
        title: "Source from pitchfork.com",
        ogImage: null,
        type: "review",
        status: "pending",
      },
      { userId: "u1", trigger: "editor_source", approveIfTrusted: true },
      { userId: "u1", expectedClaimId: "c1" },
    );
    expect(mock.enrich).toHaveBeenCalledWith("s1", "https://pitchfork.com/reviews/x", {
      keepTitle: false,
    });
    expect(mock.queue).not.toHaveBeenCalled();
  });

  it("uses the page's preview title and image", async () => {
    mock.preview.mockResolvedValueOnce({ title: "A review", imageUrl: "https://img.test/a.jpg" });
    await call({ url: "https://example.com/a" });
    expect(mock.insert.mock.calls[0][0]).toMatchObject({
      title: "A review",
      ogImage: "https://img.test/a.jpg",
    });
  });

  it("queues a Lore refresh for an approved source, and warns when it can't", async () => {
    mock.insert.mockImplementation(async (data: object) => ({
      id: "s1",
      ...data,
      status: "approved",
    }));
    expect((await call({ url: "https://example.com/a" })).status).toBe(201);
    expect(mock.queue).toHaveBeenCalledWith(artistId, "c1", {
      userId: "u1",
      trigger: "source_submission",
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mock.queue.mockRejectedValueOnce(new Error("pool"));
    expect((await (await call({ url: "https://example.com/b" })).json()).warning).toMatch(
      /Look again/,
    );
    error.mockRestore();
  });

  it("is a 409 for a source the artist already has, by canonical URL", async () => {
    mock.urls.mockResolvedValueOnce(["https://example.com/a#top"]);
    const res = await call({ url: "https://example.com/a" });
    expect(res.status).toBe(409);
    expect(mock.insert).not.toHaveBeenCalled();
    mock.insert.mockResolvedValueOnce(undefined);
    expect((await call({ url: "https://example.com/b" })).status).toBe(409);
  });

  it("is a 400 for a URL that isn't a public web page", async () => {
    expect((await call({ url: "javascript:alert(1)" })).status).toBe(400);
    expect((await call({ url: "http://127.0.0.1/" })).status).toBe(400);
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("passes on the artist check's response", async () => {
    const denied = NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
    mock.edit.mockResolvedValueOnce(denied);
    expect(await call({ url: "https://example.com/a" })).toBe(denied);
  });

  it("is a 403 when the claim changed, and a 500 when the save fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mock.insert.mockRejectedValueOnce(new OwnershipChangedError());
    expect((await call({ url: "https://example.com/a" })).status).toBe(403);
    mock.insert.mockRejectedValueOnce(new Error("pool"));
    const res = await call({ url: "https://example.com/a" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to add source" });
    error.mockRestore();
  });
});
