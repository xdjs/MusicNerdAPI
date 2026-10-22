import { describe, it, expect, afterEach, vi } from "vitest";
import { isSupabaseStorageConfigured } from "@/lib/artistImages/isSupabaseStorageConfigured";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSupabaseStorageConfigured", () => {
  it("is true only when both the URL and the service key are set", () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "key");
    expect(isSupabaseStorageConfigured()).toBe(true);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(isSupabaseStorageConfigured()).toBe(false);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "key");
    vi.stubEnv("SUPABASE_URL", "");
    expect(isSupabaseStorageConfigured()).toBe(false);
  });
});
