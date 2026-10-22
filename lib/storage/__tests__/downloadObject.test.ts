import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadObject } from "@/lib/storage/downloadObject";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co/");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
});

describe("downloadObject", () => {
  it("returns the object's bytes", async () => {
    fetchMock.mockResolvedValue(new Response(Buffer.from("%PDF-1.4")));
    const bytes = await downloadObject("lore-upload-staging", "a/b.pdf");
    expect(bytes.toString()).toBe("%PDF-1.4");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/storage/v1/object/lore-upload-staging/a/b.pdf");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-key");
  });

  it("throws when the object is missing", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    await expect(downloadObject("b", "p")).rejects.toThrow("HTTP 404");
  });
});
