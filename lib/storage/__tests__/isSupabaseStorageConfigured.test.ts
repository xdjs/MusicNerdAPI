import { describe, it, expect, vi } from "vitest";
import { isSupabaseStorageConfigured } from "@/lib/storage/isSupabaseStorageConfigured";

describe("isSupabaseStorageConfigured", () => {
  it("needs both the URL and the service key", () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    expect(isSupabaseStorageConfigured()).toBe(true);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(isSupabaseStorageConfigured()).toBe(false);
  });
});
