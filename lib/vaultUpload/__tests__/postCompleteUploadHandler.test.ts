import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  fence: vi.fn(),
  authenticate: vi.fn(),
  canEdit: vi.fn(),
  claim: vi.fn(),
  byPath: vi.fn(),
  insert: vi.fn(),
  queue: vi.fn(),
  pdf: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.authenticate }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: mock.canEdit }));
vi.mock("@/lib/ownership/getLoreClaimGeneration", () => ({ getLoreClaimGeneration: mock.claim }));
vi.mock("@/lib/vault/getVaultUploadByPath", () => ({ getVaultUploadByPath: mock.byPath }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: mock.insert }));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: mock.queue }));
vi.mock("@/lib/vaultUpload/extractPdfText", () => ({ extractPdfText: mock.pdf }));
vi.mock("@/lib/storage/downloadObject", () => ({ downloadObject: mock.download }));
vi.mock("@/lib/storage/uploadStorageObject", () => ({ uploadStorageObject: mock.upload }));
vi.mock("@/lib/storage/removeObjects", () => ({ removeObjects: mock.remove }));
vi.mock("@/lib/ownership/withArtistUploadWrite", () => ({ withArtistUploadWrite: mock.fence }));
const { postCompleteUploadHandler: complete } =
  await import("@/lib/vaultUpload/postCompleteUploadHandler");
const { signUploadTicket } = await import("@/lib/vaultUpload/signUploadTicket");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const artistId = "11111111-1111-4111-8111-111111111111";
const path = `${artistId}/fixture.pdf`;
const bytes = Buffer.from("%PDF-1.4\nfixture");
const req = (body: unknown) =>
  new Request("https://api.musicnerd.test/api/vault/upload/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
let ticket: string;

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  mock.fence.mockReset().mockImplementation(async (_a, _u, _c, write) => write({}));
  mock.authenticate.mockReset().mockResolvedValue({ userId: "owner" });
  mock.canEdit.mockReset().mockResolvedValue(true);
  mock.claim.mockReset().mockResolvedValue("claim-1");
  mock.byPath.mockReset().mockResolvedValue(undefined);
  mock.insert.mockReset().mockResolvedValue({ id: "source" });
  mock.queue.mockReset().mockResolvedValue(true);
  mock.pdf.mockReset().mockResolvedValue("A short artist-written document.");
  mock.download.mockReset().mockResolvedValue(bytes);
  mock.upload.mockReset().mockResolvedValue(undefined);
  mock.remove.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  ticket = signUploadTicket({
    expectedClaimId: "claim-1",
    userId: "owner",
    artistId,
    path,
    name: "fixture.pdf",
    type: "application/pdf",
    size: bytes.length,
    expires: Date.now() + 60_000,
  });
});

describe("postCompleteUploadHandler", () => {
  it("runs the statements in order: download, check, publish, save, refresh, clean up", async () => {
    const order: string[] = [];
    for (const [name, fn] of Object.entries(mock).filter(([name]) => name !== "fence")) {
      fn.mockImplementation(async (...args: unknown[]) => {
        order.push(name);
        if (name === "authenticate") return { userId: "owner" };
        if (name === "canEdit") return true;
        if (name === "claim") return "claim-1";
        if (name === "byPath") return undefined;
        if (name === "insert") return { id: "source", filePath: args[0] };
        if (name === "queue") return true;
        if (name === "pdf") return "A short artist-written document.";
        if (name === "download") return bytes;
        return undefined;
      });
    }
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(order).toEqual([
      "authenticate",
      "claim",
      "canEdit",
      "byPath",
      "download",
      "pdf",
      "upload",
      "insert",
      "queue",
    ]);
    expect(mock.upload).toHaveBeenCalledWith("vault-files", path, bytes, {
      contentType: "application/pdf",
      upsert: false,
      cacheControl: "3600",
    });
    expect(mock.insert).toHaveBeenCalledWith(
      {
        artistId,
        url: `https://test.supabase.co/storage/v1/object/public/vault-files/${path}`,
        title: "fixture.pdf",
        snippet: "A short artist-written document.",
        extractedText: "A short artist-written document.",
        type: "document",
        status: "approved",
        fileName: "fixture.pdf",
        fileSize: bytes.length,
        filePath: path,
        contentType: "application/pdf",
      },
      { userId: "owner", trigger: "upload" },
      { userId: "owner", expectedClaimId: "claim-1" },
    );
    expect(mock.queue).toHaveBeenCalledWith(artistId, "claim-1", {
      userId: "owner",
      trigger: "upload",
    });
    expect(mock.remove).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      status: "ok",
      source: { id: "source", filePath: expect.any(Object) },
    });
  });

  it("requires a signed-in user", async () => {
    mock.authenticate.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await complete(req({ ticket }))).status).toBe(401);
    expect(mock.download).not.toHaveBeenCalled();
  });

  it("retains public bytes and rejects completion when ownership changes during upload", async () => {
    mock.insert.mockRejectedValue(new OwnershipChangedError());
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Artist ownership changed; this operation was cancelled.",
    });
    expect(mock.upload).toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.queue).not.toHaveBeenCalled();
  });

  it("rejects forged and different-user completion tickets", async () => {
    const forged = await complete(req({ ticket: ticket + "tampered" }));
    expect(forged.status).toBe(400);
    expect(await forged.json()).toEqual({
      status: "error",
      error: "Upload expired or invalid. Please try again.",
    });
    mock.authenticate.mockResolvedValue({ userId: "other" });
    expect((await complete(req({ ticket }))).status).toBe(400);
    expect(mock.download).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("rejects an expired authentic ticket without downloading or publishing", async () => {
    const expired = signUploadTicket({
      expectedClaimId: "claim-1",
      userId: "owner",
      artistId,
      path: `${artistId}/expired.pdf`,
      name: "expired.pdf",
      type: "application/pdf",
      size: 12,
      expires: 0,
    });
    const response = await complete(req({ ticket: expired }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Upload expired. Please try again.",
    });
    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.download).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("expired ticket remains invalid when cleanup is deferred", async () => {
    const expired = signUploadTicket({
      expectedClaimId: "claim-1",
      userId: "owner",
      artistId,
      path,
      name: "fixture.pdf",
      type: "application/pdf",
      size: bytes.length,
      expires: 0,
    });
    expect((await complete(req({ ticket: expired }))).status).toBe(400);
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("extracts PDF text and queues Lore only after validating and saving the source", async () => {
    expect((await complete(req({ ticket }))).status).toBe(200);
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        extractedText: "A short artist-written document.",
        status: "approved",
      }),
      { userId: "owner", trigger: "upload" },
      { userId: "owner", expectedClaimId: "claim-1" },
    );
    expect(mock.queue).toHaveBeenCalledWith(artistId, "claim-1", {
      userId: "owner",
      trigger: "upload",
    });
    expect(mock.insert.mock.invocationCallOrder[0]).toBeLessThan(
      mock.queue.mock.invocationCallOrder[0],
    );
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("warns when a PDF had no readable text", async () => {
    mock.pdf.mockResolvedValue(null);
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(200);
    expect((await response.json()).warning).toBe(
      "PDF saved, but no readable text was found. Use a text-based PDF so Lore can read it.",
    );
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({ extractedText: null, snippet: "Uploaded file: fixture.pdf" }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("returns the saved upload with a retry warning when Lore enqueue fails, and reuses it on retry", async () => {
    mock.queue.mockRejectedValue(new Error("queue unavailable"));
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      source: { id: "source" },
      warning: expect.stringContaining("File saved"),
    });
    expect(mock.remove).not.toHaveBeenCalled();
    mock.byPath.mockResolvedValue({ id: "source", filePath: path });
    expect((await complete(req({ ticket }))).status).toBe(200);
    expect(mock.insert).toHaveBeenCalledTimes(1);
  });

  it("does not fail a saved upload when temporary-object cleanup fails", async () => {
    mock.remove.mockRejectedValue(new Error("cleanup unavailable"));
    expect((await complete(req({ ticket }))).status).toBe(200);
  });

  it("retains public bytes after a pre-save failure", async () => {
    mock.insert.mockRejectedValue(new Error("insert failed"));
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(500);
    expect((await response.json()).retryCompletion).toBe(true);
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("recovers a committed source after a lost insert response without deleting its file", async () => {
    mock.insert.mockRejectedValue(new Error("connection lost after commit"));
    mock.byPath.mockResolvedValueOnce(undefined).mockResolvedValue({ id: "committed-source" });
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(200);
    expect((await response.json()).source.id).toBe("committed-source");
    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("preserves uncertain publication and requests same-ticket retry if reconciliation fails", async () => {
    mock.insert.mockRejectedValue(new Error("connection lost"));
    mock.byPath
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error("database unavailable"));
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "error",
      error:
        "Could not confirm the upload. Retry this same file to finish; do not create a new upload.",
      retryCompletion: true,
    });
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it.each(["text/csv", "application/json"])("classifies %s uploads as data", async type => {
    const data = Buffer.from(
      type === "application/json" ? '{"release":"demo"}' : "release,year\ndemo,2025",
    );
    mock.download.mockResolvedValue(data);
    const dataTicket = signUploadTicket({
      expectedClaimId: "claim-1",
      userId: "owner",
      artistId,
      path: `${artistId}/data`,
      name: "data",
      type,
      size: data.length,
      expires: Date.now() + 60_000,
    });
    expect((await complete(req({ ticket: dataTicket }))).status).toBe(200);
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "data", extractedText: data.toString("utf8") }),
      { userId: "owner", trigger: "upload" },
      { userId: "owner", expectedClaimId: "claim-1" },
    );
    expect(mock.pdf).not.toHaveBeenCalled();
  });

  it.each(["size", "magic"])(
    "retains rejected %s staging bytes while returning 400",
    async kind => {
      mock.download.mockResolvedValue(
        Buffer.from(kind === "size" ? "wrong size" : "x".repeat(bytes.length)),
      );
      const response = await complete(req({ ticket }));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain(kind === "size" ? "size" : "content");
      expect(mock.remove).not.toHaveBeenCalled();
      expect(mock.upload).not.toHaveBeenCalled();
      expect(mock.insert).not.toHaveBeenCalled();
    },
  );

  it("rejects bad bytes without deleting concurrent staged replacements", async () => {
    mock.download.mockResolvedValue(Buffer.from("wrong size"));
    expect((await complete(req({ ticket }))).status).toBe(400);
    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("reauthorizes completion after a claim is revoked", async () => {
    mock.canEdit.mockResolvedValue(false);
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Not authorized for this artist",
    });
    expect(mock.download).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("rejects revoked owner without deleting staged bytes", async () => {
    mock.canEdit.mockResolvedValue(false);
    expect((await complete(req({ ticket }))).status).toBe(403);
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("rejects mid-upload ownership loss while retaining bytes for reconciliation", async () => {
    mock.insert.mockRejectedValue(new OwnershipChangedError());
    expect((await complete(req({ ticket }))).status).toBe(403);
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("throws into a retryable 500 when the staged object is missing", async () => {
    mock.download.mockRejectedValue(new Error("HTTP 404"));
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(500);
    expect((await response.json()).retryCompletion).toBe(true);
    expect(mock.upload).not.toHaveBeenCalled();
  });

  it("answers a JSON 500 with CORS when signing in throws", async () => {
    mock.authenticate.mockRejectedValueOnce(new Error("db down"));
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Could not finish the upload. Please retry this file.",
      retryCompletion: true,
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

it("rejects a ticket from an earlier claim even when the same user can edit again", async () => {
  mock.claim.mockResolvedValue("replacement-claim");
  expect((await complete(req({ ticket }))).status).toBe(403);
  expect(mock.download).not.toHaveBeenCalled();
  expect(mock.upload).not.toHaveBeenCalled();
  expect(mock.insert).not.toHaveBeenCalled();
});

it("never upgrades a revoked claim ticket to independent contributor authority", async () => {
  mock.claim.mockResolvedValue(null);
  mock.canEdit.mockResolvedValue(true); // Admin status is not a replacement for original claim authority.
  expect((await complete(req({ ticket }))).status).toBe(403);
  expect(mock.insert).not.toHaveBeenCalled();
  expect(mock.upload).not.toHaveBeenCalled();
});
it("does not expose an existing source when revocation wins after the initial check", async () => {
  mock.byPath.mockResolvedValue({ id: "preserved-source", extractedText: "private fixture" });
  mock.fence.mockRejectedValueOnce(new OwnershipChangedError());
  const response = await complete(req({ ticket }));
  expect(response.status).toBe(403);
  expect(await response.text()).not.toContain("private fixture");
  expect(mock.byPath).not.toHaveBeenCalled();
});
