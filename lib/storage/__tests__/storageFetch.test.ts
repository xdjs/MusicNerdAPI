import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { storageFetch } from "@/lib/storage/storageFetch";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co/");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("storageFetch", () => {
  it("calls the Storage API with the service role, refusing redirects", async () => {
    await storageFetch("object/list/user-profile-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/storage/v1/object/list/user-profile-images");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.body).toBe("{}");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer service-key");
    expect(headers.get("apikey")).toBe("service-key");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("returns the response", async () => {
    const response = new Response("ok", { status: 201 });
    fetchMock.mockResolvedValueOnce(response);
    expect(await storageFetch("object/b/p", { method: "POST" })).toBe(response);
  });

  it("throws when Storage is not configured, without calling fetch", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(storageFetch("object/b/p", {})).rejects.toThrow(
      "Supabase Storage is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
