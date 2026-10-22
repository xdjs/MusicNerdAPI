import { describe, it, expect, vi, afterEach } from "vitest";
import { profileImagePublicUrl } from "@/lib/artistImages/profileImagePublicUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("profileImagePublicUrl", () => {
  it("builds the bucket's public object URL from SUPABASE_URL, trailing slash or not", () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co/");
    expect(profileImagePublicUrl("profile-images/a_1.png")).toBe(
      "https://test.supabase.co/storage/v1/object/public/vault-files/profile-images/a_1.png",
    );
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    expect(profileImagePublicUrl("profile-images/a_1.png")).toBe(
      "https://test.supabase.co/storage/v1/object/public/vault-files/profile-images/a_1.png",
    );
  });
});
