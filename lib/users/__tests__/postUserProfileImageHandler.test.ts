import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import sharp from "sharp";

const { authenticateRequest, resolve, upload } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  resolve: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
vi.mock("@/lib/users/resolveProfileImageOwner", () => ({ resolveProfileImageOwner: resolve }));
vi.mock("@/lib/storage/uploadStorageObject", () => ({ uploadStorageObject: upload }));
const { postUserProfileImageHandler } = await import("@/lib/users/postUserProfileImageHandler");

const png = await sharp({
  create: { width: 4, height: 8, channels: 3, background: "#ff0000" },
})
  .png()
  .toBuffer();
const post = (file?: File, headers: Record<string, string> = {}) => {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("https://x/api/user/profile-image", { method: "POST", body: form, headers });
};
const image = (bytes: Buffer | string = png, type = "image/png") =>
  new File([bytes as BlobPart], "a.png", { type });

beforeEach(() => {
  authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  resolve
    .mockReset()
    .mockResolvedValue({ owner: { id: "u1", privyUserId: "p" }, folder: "identity-h" });
  upload.mockReset().mockResolvedValue(undefined);
});

describe("postUserProfileImageHandler", () => {
  it("re-encodes the image as a 512x512 WebP and replaces avatar.webp in the owner's folder", async () => {
    const res = await postUserProfileImageHandler(post(image()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", success: true });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(upload).toHaveBeenCalledTimes(1);
    const [bucket, path, body, options] = upload.mock.calls[0];
    expect(bucket).toBe("user-profile-images");
    expect(path).toBe("identity-h/avatar.webp");
    expect(options).toEqual({ contentType: "image/webp", upsert: true, cacheControl: "0" });
    const meta = await sharp(body as Buffer).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 512, height: 512 });
  });

  it("forwards the 401 when not signed in", async () => {
    const denied = NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
    authenticateRequest.mockResolvedValue(denied);
    expect(await postUserProfileImageHandler(post(image()))).toBe(denied);
  });

  it("is 413 when the declared body is over 2 MB plus form overhead", async () => {
    const res = await postUserProfileImageHandler(
      post(image(), { "content-length": String(2 * 1024 * 1024 + 65537) }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Choose an image smaller than 2 MB",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    ["no file", undefined],
    ["an empty file", image("")],
    ["a GIF", image(png, "image/gif")],
    ["a file over 2 MB", image(Buffer.alloc(2 * 1024 * 1024 + 1))],
  ])("is 400 for %s", async (_label, file) => {
    const res = await postUserProfileImageHandler(post(file));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Choose a JPG, PNG or WebP image smaller than 2 MB",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("is 400 for bytes the decoder cannot read", async () => {
    const res = await postUserProfileImageHandler(post(image(Buffer.from("not an image"))));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      status: "error",
      error: "This image could not be read. Try another JPG, PNG or WebP.",
    });
  });

  it("forwards the owner's 401 or 409 after decoding", async () => {
    const changed = NextResponse.json({ status: "error", error: "x" }, { status: 409 });
    resolve.mockResolvedValue(changed);
    expect(await postUserProfileImageHandler(post(image()))).toBe(changed);
    expect(upload).not.toHaveBeenCalled();
  });

  it("is 503 when Storage fails", async () => {
    upload.mockRejectedValue(new Error("Storage upload failed: HTTP 500"));
    const res = await postUserProfileImageHandler(post(image()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not save your profile photo. Try again.",
    });
  });

  it("is 503 when the body is not a form", async () => {
    const res = await postUserProfileImageHandler(
      new Request("https://x/api/user/profile-image", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(503);
  });

  it("answers JSON 503 with CORS when authentication throws", async () => {
    authenticateRequest.mockRejectedValue(new Error("user lookup failed"));
    const res = await postUserProfileImageHandler(post(image()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not save your profile photo. Try again.",
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
