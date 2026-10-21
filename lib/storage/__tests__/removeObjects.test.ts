import { describe, it, expect, vi, beforeEach } from "vitest";
import { removeObjects } from "@/lib/storage/removeObjects";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co/");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
});

describe("removeObjects", () => {
  it("DELETEs the given paths from the bucket", async () => {
    fetchMock.mockResolvedValue(new Response("[]"));
    await removeObjects("lore-upload-staging", ["a/b.pdf"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/storage/v1/object/lore-upload-staging");
    expect(init.method).toBe("DELETE");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ prefixes: ["a/b.pdf"] });
  });

  it("throws when storage refuses", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));
    await expect(removeObjects("b", ["p"])).rejects.toThrow("HTTP 503");
  });
});
