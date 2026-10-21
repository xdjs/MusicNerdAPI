import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { storageRequest } = vi.hoisted(() => ({ storageRequest: vi.fn() }));
vi.mock("@/lib/artistImages/storageRequest", () => ({ storageRequest }));
const { uploadProfileImage } = await import("@/lib/artistImages/uploadProfileImage");

beforeEach(() => {
  storageRequest.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uploadProfileImage", () => {
  it("POSTs the bytes to the object path in the vault bucket, never upserting", async () => {
    storageRequest.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const body = Buffer.from([1, 2, 3]);
    expect(await uploadProfileImage("profile-images/a_1.png", body, "image/png")).toBe(true);
    const [path, init] = storageRequest.mock.calls[0];
    expect(path).toBe("object/vault-files/profile-images/a_1.png");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "image/png",
      "Cache-Control": "max-age=3600",
      "x-upsert": "false",
    });
    expect(Buffer.from(init.body)).toEqual(body);
  });

  it("is false, after logging, when storage refuses", async () => {
    storageRequest.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Duplicate" }), { status: 409 }),
    );
    expect(await uploadProfileImage("profile-images/a_1.png", Buffer.alloc(1), "image/png")).toBe(
      false,
    );
    expect(console.error).toHaveBeenCalledWith(
      "[artist/profile-image] Supabase upload error:",
      409,
      { error: "Duplicate" },
    );
  });
});
