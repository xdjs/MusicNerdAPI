import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSignedUploadUrl } from "@/lib/storage/createSignedUploadUrl";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co/");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
});

describe("createSignedUploadUrl", () => {
  it("asks storage for a signed upload URL and returns it absolute", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ url: "/object/upload/sign/lore-upload-staging/a/b.pdf?token=t" }),
      ),
    );
    expect(await createSignedUploadUrl("lore-upload-staging", "a/b.pdf")).toBe(
      "https://test.supabase.co/storage/v1/object/upload/sign/lore-upload-staging/a/b.pdf?token=t",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://test.supabase.co/storage/v1/object/upload/sign/lore-upload-staging/a/b.pdf",
    );
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-key");
    expect(headers.get("apikey")).toBe("test-key");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("throws a fixed diagnostic on a storage error or a missing token", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 400 }));
    await expect(createSignedUploadUrl("b", "p")).rejects.toThrow("HTTP 400");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ url: "/object/x" })));
    await expect(createSignedUploadUrl("b", "p")).rejects.toThrow("No token returned by API");
  });

  it("throws when storage is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    await expect(createSignedUploadUrl("b", "p")).rejects.toThrow(
      "Supabase Storage is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
