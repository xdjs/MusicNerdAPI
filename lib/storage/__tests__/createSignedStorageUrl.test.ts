import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { storageFetch } = vi.hoisted(() => ({ storageFetch: vi.fn() }));
vi.mock("@/lib/storage/storageFetch", () => ({ storageFetch }));
const { createSignedStorageUrl } = await import("@/lib/storage/createSignedStorageUrl");

beforeEach(() => {
  storageFetch.mockReset();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co/");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createSignedStorageUrl", () => {
  it("signs a path for a number of seconds and returns the absolute URL", async () => {
    storageFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ signedURL: "/object/sign/user-profile-images/u1/avatar.webp?token=t" }),
        { status: 200 },
      ),
    );
    const url = await createSignedStorageUrl("user-profile-images", "u1/avatar.webp", 3600);
    expect(url).toBe(
      "https://example.supabase.co/storage/v1/object/sign/user-profile-images/u1/avatar.webp?token=t",
    );
    expect(storageFetch).toHaveBeenCalledWith("object/sign/user-profile-images/u1/avatar.webp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
  });

  it("throws on a Storage error", async () => {
    storageFetch.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    await expect(createSignedStorageUrl("b", "p", 60)).rejects.toThrow(
      "Storage sign failed: HTTP 404",
    );
  });
});
