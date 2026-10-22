import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
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
    for (const [name, fn] of Object.entries(mock)) {
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
      "remove",
    ]);
    expect(mock.upload).toHaveBeenCalledWith("vault-files", path, bytes, {
      contentType: "application/pdf",
      upsert: true,
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
    expect(mock.remove).toHaveBeenCalledWith("lore-upload-staging", [path]);
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

  it("removes the public copy and rejects completion when ownership changes during upload", async () => {
    mock.insert.mockRejectedValue(new OwnershipChangedError());
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Artist ownership changed; this operation was cancelled.",
    });
    expect(mock.upload).toHaveBeenCalled();
    expect(mock.remove).toHaveBeenCalledTimes(2);
    expect(mock.remove).toHaveBeenNthCalledWith(1, "vault-files", [path]);
    expect(mock.remove).toHaveBeenNthCalledWith(2, "lore-upload-staging", [path]);
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

  it("cleans an expired authentic ticket without downloading or publishing", async () => {
    const expired = signUploadTicket({
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
    expect(mock.remove).toHaveBeenCalledWith("lore-upload-staging", [`${artistId}/expired.pdf`]);
    expect(mock.download).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("retains retryability if expired-ticket cleanup fails", async () => {
    const expired = signUploadTicket({
      userId: "owner",
      artistId,
      path: `${artistId}/expired.pdf`,
      name: "expired.pdf",
      type: "application/pdf",
      size: 12,
      expires: 0,
    });
    mock.remove.mockRejectedValueOnce(new Error("unavailable"));
    const response = await complete(req({ ticket: expired }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Could not finish the upload. Please retry this file.",
      retryCompletion: true,
    });
    expect((await complete(req({ ticket: expired }))).status).toBe(400);
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
    expect(mock.remove).toHaveBeenCalled();
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
    expect(mock.remove).toHaveBeenCalled();
    mock.byPath.mockResolvedValue({ id: "source", filePath: path });
    expect((await complete(req({ ticket }))).status).toBe(200);
    expect(mock.insert).toHaveBeenCalledTimes(1);
  });

  it("does not fail a saved upload when temporary-object cleanup fails", async () => {
    mock.remove.mockRejectedValue(new Error("cleanup unavailable"));
    expect((await complete(req({ ticket }))).status).toBe(200);
  });

  it("removes the public copy after a confirmed pre-save failure", async () => {
    mock.insert.mockRejectedValue(new Error("insert failed"));
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(500);
    expect((await response.json()).retryCompletion).toBe(true);
    expect(mock.remove).toHaveBeenLastCalledWith("vault-files", [path]);
  });

  it("recovers a committed source after a lost insert response without deleting its file", async () => {
    mock.insert.mockRejectedValue(new Error("connection lost after commit"));
    mock.byPath.mockResolvedValueOnce(undefined).mockResolvedValue({ id: "committed-source" });
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(200);
    expect((await response.json()).source.id).toBe("committed-source");
    expect(mock.remove).toHaveBeenCalledTimes(1);
    expect(mock.remove).toHaveBeenLastCalledWith("lore-upload-staging", [path]);
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
    "removes rejected %s bytes from staging before returning 400",
    async kind => {
      mock.download.mockResolvedValue(
        Buffer.from(kind === "size" ? "wrong size" : "x".repeat(bytes.length)),
      );
      const response = await complete(req({ ticket }));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain(kind === "size" ? "size" : "content");
      expect(mock.remove).toHaveBeenLastCalledWith("lore-upload-staging", [path]);
      expect(mock.upload).not.toHaveBeenCalled();
      expect(mock.insert).not.toHaveBeenCalled();
    },
  );

  it("keeps completion retryable when rejection cleanup fails", async () => {
    mock.download.mockResolvedValue(Buffer.from("wrong size"));
    mock.remove.mockRejectedValueOnce(new Error("storage unavailable"));
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(500);
    expect((await response.json()).retryCompletion).toBe(true);
    expect((await complete(req({ ticket }))).status).toBe(400);
    expect(mock.remove).toHaveBeenCalledTimes(2);
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
    expect(mock.remove).toHaveBeenCalledWith("lore-upload-staging", [path]);
  });

  it("keeps a revoked-owner rejection retryable if staging cleanup fails", async () => {
    mock.canEdit.mockResolvedValue(false);
    mock.remove.mockRejectedValue(new Error("storage unavailable"));
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(500);
    expect((await response.json()).retryCompletion).toBe(true);
    expect(mock.download).not.toHaveBeenCalled();
  });

  it("keeps mid-upload ownership loss retryable when only staging cleanup fails", async () => {
    mock.insert.mockRejectedValue(new OwnershipChangedError());
    mock.remove
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("staging unavailable"));
    const response = await complete(req({ ticket }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Could not clean up the rejected upload. Please retry this file.",
      retryCompletion: true,
    });
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
