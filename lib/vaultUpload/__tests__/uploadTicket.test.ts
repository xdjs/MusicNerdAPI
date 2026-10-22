import { describe, it, expect, beforeEach, vi } from "vitest";
import { signUploadTicket } from "@/lib/vaultUpload/signUploadTicket";
import { verifyUploadTicket } from "@/lib/vaultUpload/verifyUploadTicket";

const ticket = {
  userId: "owner",
  artistId: "11111111-1111-4111-8111-111111111111",
  path: "11111111-1111-4111-8111-111111111111/fixture.pdf",
  name: "fixture.pdf",
  type: "application/pdf",
  size: 16,
  expires: 1_800_000_000_000,
};

beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key"));

describe("signUploadTicket / verifyUploadTicket", () => {
  it("round-trips a ticket for its user", () => {
    const value = signUploadTicket(ticket);
    expect(value.split(".")).toHaveLength(2);
    expect(verifyUploadTicket(value, "owner")).toEqual(ticket);
  });

  it("rejects a tampered ticket, an extra segment and a missing MAC", () => {
    const value = signUploadTicket(ticket);
    expect(() => verifyUploadTicket(value + "tampered", "owner")).toThrow("Invalid upload ticket");
    expect(() => verifyUploadTicket(value + ".extra", "owner")).toThrow("Invalid upload ticket");
    expect(() => verifyUploadTicket(value.split(".")[0], "owner")).toThrow("Invalid upload ticket");
    expect(() => verifyUploadTicket("", "owner")).toThrow("Invalid upload ticket");
  });

  it("rejects a ticket signed for another user", () => {
    expect(() => verifyUploadTicket(signUploadTicket(ticket), "other")).toThrow(
      "Invalid upload ticket",
    );
  });

  it("rejects a ticket signed under another key", () => {
    const value = signUploadTicket(ticket);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "rotated-key");
    expect(() => verifyUploadTicket(value, "owner")).toThrow("Invalid upload ticket");
  });

  it("still verifies an expired ticket, so the caller can clean it up", () => {
    const expired = { ...ticket, expires: 0 };
    expect(verifyUploadTicket(signUploadTicket(expired), "owner").expires).toBe(0);
  });
});
