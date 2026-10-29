import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailClaimApproved } from "@/lib/claims/emailClaimApproved";

const m = vi.hoisted(() => ({ user: vi.fn(), artist: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/users/getUserById", () => ({ getUserById: m.user }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
vi.mock("@/lib/email/sendClaimApprovedEmail", () => ({ sendClaimApprovedEmail: m.send }));

const claim = { userId: "u1", artistId: "a1" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.user.mockResolvedValue({ email: "a@example.test" });
  m.artist.mockResolvedValue({ name: "Bio Ritmo" });
  m.send.mockResolvedValue(true);
});

describe("emailClaimApproved", () => {
  it("emails the claimant about their artist", async () => {
    await emailClaimApproved(claim);
    expect(m.send).toHaveBeenCalledWith("a@example.test", "Bio Ritmo", "a1");
  });

  it("skips a claimant without an email", async () => {
    m.user.mockResolvedValueOnce({ email: null });
    await emailClaimApproved(claim);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("sends a generic email when the artist can't be read, and never throws", async () => {
    m.artist.mockResolvedValueOnce(undefined);
    await emailClaimApproved(claim);
    expect(m.send).toHaveBeenCalledWith("a@example.test", null, "a1");
    m.user.mockRejectedValueOnce(new Error("db down"));
    await expect(emailClaimApproved(claim)).resolves.toBeUndefined();
  });
});
