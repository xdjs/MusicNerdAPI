import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  authenticate: vi.fn(),
  canEdit: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.authenticate }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: mock.canEdit }));
vi.mock("@/lib/storage/createSignedUploadUrl", () => ({ createSignedUploadUrl: mock.sign }));
const { postSignUploadHandler } = await import("@/lib/vaultUpload/postSignUploadHandler");
const { verifyUploadTicket } = await import("@/lib/vaultUpload/verifyUploadTicket");

const artistId = "11111111-1111-4111-8111-111111111111";
const req = (body: unknown) =>
  new Request("https://api.musicnerd.test/api/vault/upload/sign", {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  mock.authenticate.mockReset().mockResolvedValue({ userId: "owner" });
  mock.canEdit.mockReset().mockResolvedValue(true);
  mock.sign.mockReset().mockResolvedValue("https://storage.example/signed?token=t");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("postSignUploadHandler", () => {
  it("accepts exactly 10 MiB and rejects one byte over before creating an upload", async () => {
    const body = { artistId, name: "file.pdf", type: "", size: 10 * 1024 * 1024 };
    const response = await postSignUploadHandler(req(body));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.contentType).toBe("application/pdf");
    expect(json.signedUrl).toBe("https://storage.example/signed?token=t");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect((await postSignUploadHandler(req({ ...body, size: body.size + 1 }))).status).toBe(400);
    expect(mock.sign).toHaveBeenCalledTimes(1);
  });

  it("stages under the artist with a random prefix and a sanitized name, and signs a 15-minute ticket for the user", async () => {
    const before = Date.now();
    const response = await postSignUploadHandler(
      req({ artistId, name: "press kit (final).pdf", type: "application/pdf", size: 100 }),
    );
    const { ticket } = await response.json();
    const parsed = verifyUploadTicket(ticket, "owner");
    expect(parsed).toMatchObject({
      userId: "owner",
      artistId,
      name: "press kit (final).pdf",
      type: "application/pdf",
      size: 100,
    });
    expect(parsed.path).toMatch(new RegExp(`^${artistId}/[0-9a-f-]{36}_press_kit__final_\\.pdf$`));
    expect(parsed.expires).toBeGreaterThanOrEqual(before + 15 * 60_000);
    expect(mock.sign).toHaveBeenCalledWith("lore-upload-staging", parsed.path);
  });

  it("requires authentication and artist authorization", async () => {
    const body = { artistId, name: "file.pdf", type: "application/pdf", size: 100 };
    mock.authenticate.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await postSignUploadHandler(req(body))).status).toBe(401);
    mock.authenticate.mockResolvedValue({ userId: "other" });
    mock.canEdit.mockResolvedValue(false);
    const forbidden = await postSignUploadHandler(req(body));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({
      status: "error",
      error: "Not authorized for this artist",
    });
    expect(mock.canEdit).toHaveBeenCalledWith("other", artistId);
    expect(mock.sign).not.toHaveBeenCalled();
  });

  it("rejects an unsupported type after authorization", async () => {
    const response = await postSignUploadHandler(
      req({ artistId, name: "archive.zip", type: "application/zip", size: 100 }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: "error", error: "File type not supported" });
    expect(mock.sign).not.toHaveBeenCalled();
  });

  it("answers 500 with Web's message when storage cannot sign", async () => {
    mock.sign.mockRejectedValue(new Error("HTTP 500"));
    const response = await postSignUploadHandler(
      req({ artistId, name: "file.pdf", type: "application/pdf", size: 100 }),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Could not prepare file storage. Please try again.",
    });
  });
});
