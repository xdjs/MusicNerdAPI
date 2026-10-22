import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  authenticate: vi.fn(),
  canEdit: vi.fn(),
  claim: vi.fn(),
  insert: vi.fn(),
  queue: vi.fn(),
  pdf: vi.fn(),
  configured: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.authenticate }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: mock.canEdit }));
vi.mock("@/lib/ownership/getLoreClaimGeneration", () => ({ getLoreClaimGeneration: mock.claim }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: mock.insert }));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: mock.queue }));
vi.mock("@/lib/vaultUpload/extractPdfText", () => ({ extractPdfText: mock.pdf }));
vi.mock("@/lib/storage/isSupabaseStorageConfigured", () => ({
  isSupabaseStorageConfigured: mock.configured,
}));
vi.mock("@/lib/storage/uploadStorageObject", () => ({ uploadStorageObject: mock.upload }));
vi.mock("@/lib/storage/removeObjects", () => ({ removeObjects: mock.remove }));
const { postUploadHandler } = await import("@/lib/vaultUpload/postUploadHandler");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const req = (file: File | null, artistId: string | null = "artist-x") => {
  const form = new FormData();
  if (file) form.append("file", file);
  if (artistId !== null) form.append("artistId", artistId);
  return new Request("https://api.musicnerd.test/api/vault/upload", { method: "POST", body: form });
};

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  mock.authenticate.mockReset().mockResolvedValue({ userId: "admin-1" });
  mock.canEdit.mockReset().mockResolvedValue(true);
  mock.claim.mockReset().mockResolvedValue("claim-1");
  mock.insert.mockReset().mockResolvedValue({ id: "src-1" });
  mock.queue.mockReset().mockResolvedValue(true);
  mock.pdf.mockReset().mockResolvedValue(null);
  mock.configured.mockReset().mockReturnValue(true);
  mock.upload.mockReset().mockResolvedValue(undefined);
  mock.remove.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("postUploadHandler", () => {
  it("uploads for an authorized user: stores the key, not the URL, and queues Lore", async () => {
    const res = await postUploadHandler(
      req(new File([png], "press-photo.png", { type: "image/png" })),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "ok", success: true, source: { id: "src-1" } });
    const [data, provenance, authorization] = mock.insert.mock.calls[0];
    expect(data.filePath).toMatch(/^artist-x\/\d+_press-photo\.png$/);
    expect(data.url).toBe(
      `https://test.supabase.co/storage/v1/object/public/vault-files/${data.filePath}`,
    );
    expect(data).toMatchObject({
      artistId: "artist-x",
      title: "press-photo.png",
      type: "image",
      status: "approved",
      fileName: "press-photo.png",
      fileSize: png.byteLength,
      contentType: "image/png",
      extractedText: null,
      snippet: "Uploaded file: press-photo.png (8 B)",
    });
    expect(provenance).toEqual({ userId: "admin-1", trigger: "upload" });
    expect(authorization).toEqual({ userId: "admin-1", expectedClaimId: "claim-1" });
    expect(mock.upload).toHaveBeenCalledWith("vault-files", data.filePath, Buffer.from(png), {
      contentType: "image/png",
      upsert: false,
      cacheControl: "3600",
    });
    expect(mock.queue).toHaveBeenCalledWith("artist-x", "claim-1", {
      userId: "admin-1",
      trigger: "upload",
    });
    expect(mock.claim.mock.invocationCallOrder[0]).toBeLessThan(
      mock.canEdit.mock.invocationCallOrder[0],
    );
  });

  it("requires a signed-in user and rejects a non-admin with no claim", async () => {
    mock.authenticate.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect(
      (await postUploadHandler(req(new File([png], "photo.png", { type: "image/png" })))).status,
    ).toBe(401);
    mock.canEdit.mockResolvedValue(false);
    const res = await postUploadHandler(req(new File([png], "photo.png", { type: "image/png" })));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", error: "Not authorized for this artist" });
    expect(mock.upload).not.toHaveBeenCalled();
  });

  it("rejects a missing file or artist", async () => {
    const res = await postUploadHandler(req(null));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "File and artistId are required" });
  });

  it("rejects a file over 10 MiB with its size", async () => {
    const file = new File([Buffer.alloc(13 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    const res = await postUploadHandler(req(file));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      status: "error",
      error: "File too large: 13.0 MB (maximum 10 MB per file)",
    });
  });

  it("rejects an unsupported type with the supported list", async () => {
    const res = await postUploadHandler(
      req(new File(["zip"], "a.zip", { type: "application/zip" })),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      status: "error",
      error:
        'File type not supported: "application/zip". Supported: PDF, TXT, MD, CSV, JSON, DOCX, images, audio.',
    });
  });

  it("rejects a file whose bytes contradict its type: the bad magic byte", async () => {
    const res = await postUploadHandler(
      req(new File(["not a pdf"], "doc.pdf", { type: "application/pdf" })),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      status: "error",
      error: "File content does not match declared type",
    });
    expect(mock.upload).not.toHaveBeenCalled();
  });

  it("accepts a .md file the browser reports with an EMPTY MIME type and extracts its text", async () => {
    const res = await postUploadHandler(
      req(new File(["# Notes\nsome content here"], "notes.md", { type: "" })),
    );
    expect(res.status).toBe(200);
    const [data] = mock.insert.mock.calls[0];
    expect(data.contentType).toBe("text/markdown");
    expect(data.type).toBe("document");
    expect(data.extractedText).toContain("some content here");
    expect(data.snippet).toBe("# Notes\nsome content here");
  });

  it("extracts PDF text, and warns when there is none", async () => {
    mock.pdf.mockResolvedValueOnce("x".repeat(400));
    const pdf = () => new File(["%PDF-1.4\nfixture"], "doc.pdf", { type: "application/pdf" });
    let res = await postUploadHandler(req(pdf()));
    expect((await res.json()).warning).toBeUndefined();
    expect(mock.insert.mock.calls[0][0].snippet).toBe("x".repeat(300));
    mock.pdf.mockResolvedValueOnce(null);
    res = await postUploadHandler(req(pdf()));
    expect((await res.json()).warning).toBe(
      "PDF saved, but no readable text was found. Upload a text-based PDF to use it in Lore.",
    );
  });

  it("returns a clear 503 (not a generic 500) when storage is not configured", async () => {
    mock.configured.mockReturnValue(false);
    const res = await postUploadHandler(
      req(new File(["%PDF"], "doc.pdf", { type: "application/pdf" })),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not configured/i);
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("answers 500 when storage refuses the file", async () => {
    mock.upload.mockRejectedValue(new Error("HTTP 500"));
    const res = await postUploadHandler(req(new File([png], "photo.png", { type: "image/png" })));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Failed to upload file to storage",
    });
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("returns the saved upload with a warning when Lore enqueue fails", async () => {
    mock.queue.mockRejectedValue(new Error("queue unavailable"));
    const res = await postUploadHandler(req(new File([png], "photo.png", { type: "image/png" })));
    expect(res.status).toBe(200);
    expect((await res.json()).warning).toBe(
      "File saved. Use Look again to retry the Lore refresh; do not upload again.",
    );
  });

  it("removes the stored file and answers 403 when ownership changed during the upload", async () => {
    mock.insert.mockRejectedValue(new OwnershipChangedError());
    const res = await postUploadHandler(req(new File([png], "photo.png", { type: "image/png" })));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Artist ownership changed; this operation was cancelled.",
    });
    expect(mock.remove).toHaveBeenCalledWith("vault-files", [mock.upload.mock.calls[0][1]]);
    expect(mock.queue).not.toHaveBeenCalled();
  });

  it("answers a generic 500 when the save fails, leaving the stored file", async () => {
    mock.insert.mockRejectedValue(new Error("insert failed"));
    const res = await postUploadHandler(req(new File([png], "photo.png", { type: "image/png" })));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to upload file" });
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("answers a JSON 500 with CORS when signing in throws", async () => {
    mock.authenticate.mockRejectedValueOnce(new Error("db down"));
    const response = await postUploadHandler(
      req(new File([png], "photo.png", { type: "image/png" })),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", error: "Failed to upload file" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
