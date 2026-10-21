import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { storageRequest } from "@/lib/artistImages/storageRequest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co/");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  fetchMock.mockReset().mockResolvedValue(new Response("", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("storageRequest", () => {
  it("calls the storage API as the service role, refusing redirects, keeping the caller's headers", async () => {
    await storageRequest("object/vault-files/profile-images/a.png", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: "x",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/storage/v1/object/vault-files/profile-images/a.png");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.headers).toEqual({
      Authorization: "Bearer service-key",
      apikey: "service-key",
      "Content-Type": "image/png",
    });
  });

  it("returns the response whatever its status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 403 }));
    const response = await storageRequest("object/vault-files", { method: "DELETE" });
    expect(response.status).toBe(403);
  });
});
