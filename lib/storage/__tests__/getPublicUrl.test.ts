import { describe, it, expect, vi } from "vitest";
import { getPublicUrl } from "@/lib/storage/getPublicUrl";

describe("getPublicUrl", () => {
  it("builds the public object URL without a double slash", () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co/");
    expect(getPublicUrl("vault-files", "a/b.pdf")).toBe(
      "https://test.supabase.co/storage/v1/object/public/vault-files/a/b.pdf",
    );
  });
});
