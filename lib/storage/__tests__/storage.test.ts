import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSignedUploadUrl } from "@/lib/storage/createSignedUploadUrl";
import { downloadObject } from "@/lib/storage/downloadObject";
import { getPublicUrl } from "@/lib/storage/getPublicUrl";
import { isSupabaseStorageConfigured } from "@/lib/storage/isSupabaseStorageConfigured";
import { removeObjects } from "@/lib/storage/removeObjects";
import { uploadObject } from "@/lib/storage/uploadObject";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co/");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
});
const headersOf = (call: number) => fetchMock.mock.calls[call][1].headers as Record<string, string>;

describe("isSupabaseStorageConfigured", () => {
  it("needs both the URL and the service key", () => {
    expect(isSupabaseStorageConfigured()).toBe(true);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(isSupabaseStorageConfigured()).toBe(false);
  });
});

describe("getPublicUrl", () => {
  it("builds the public object URL without a double slash", () => {
    expect(getPublicUrl("vault-files", "a/b.pdf")).toBe(
      "https://test.supabase.co/storage/v1/object/public/vault-files/a/b.pdf",
    );
  });
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
    expect(headersOf(0).Authorization).toBe("Bearer test-key");
    expect(headersOf(0).apikey).toBe("test-key");
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
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("downloadObject", () => {
  it("returns the object's bytes", async () => {
    fetchMock.mockResolvedValue(new Response(Buffer.from("%PDF-1.4")));
    const bytes = await downloadObject("lore-upload-staging", "a/b.pdf");
    expect(bytes.toString()).toBe("%PDF-1.4");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://test.supabase.co/storage/v1/object/lore-upload-staging/a/b.pdf",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("throws when the object is missing", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    await expect(downloadObject("b", "p")).rejects.toThrow("HTTP 404");
  });
});

describe("uploadObject", () => {
  it("POSTs the bytes with the content type, not upserting by default", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    await uploadObject("vault-files", "a/b.pdf", Buffer.from("%PDF"), "application/pdf");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/storage/v1/object/vault-files/a/b.pdf");
    expect(init.method).toBe("POST");
    expect(headersOf(0)["Content-Type"]).toBe("application/pdf");
    expect(headersOf(0)["x-upsert"]).toBe("false");
    expect(Buffer.from(init.body).toString()).toBe("%PDF");
  });

  it("upserts when asked and throws on refusal", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    await expect(
      uploadObject("vault-files", "a/b.pdf", Buffer.from("x"), "text/plain", { upsert: true }),
    ).rejects.toThrow("HTTP 500");
    expect(headersOf(0)["x-upsert"]).toBe("true");
  });
});

describe("removeObjects", () => {
  it("DELETEs the given paths from the bucket", async () => {
    fetchMock.mockResolvedValue(new Response("[]"));
    await removeObjects("lore-upload-staging", ["a/b.pdf"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/storage/v1/object/lore-upload-staging");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ prefixes: ["a/b.pdf"] });
  });

  it("throws when storage refuses", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));
    await expect(removeObjects("b", ["p"])).rejects.toThrow("HTTP 503");
  });
});
