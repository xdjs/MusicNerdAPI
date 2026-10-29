import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendClaimApprovedEmail } from "@/lib/email/sendClaimApprovedEmail";

const m = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: m.send }));
beforeEach(() => {
  vi.clearAllMocks();
  m.send.mockResolvedValue(true);
});

describe("sendClaimApprovedEmail", () => {
  it("names the artist in the subject, on one line", async () => {
    expect(await sendClaimApprovedEmail("a@example.test", "Bio\nRitmo", "a1")).toBe(true);
    expect(m.send).toHaveBeenCalledWith({
      to: "a@example.test",
      subject: "Your Bio Ritmo profile on Music Nerd is approved 🎉",
      html: expect.stringContaining("/artist/a1"),
    });
  });

  it("uses a generic subject without a name", async () => {
    await sendClaimApprovedEmail("a@example.test", null, "a1");
    expect(m.send.mock.calls[0][0].subject).toBe("Your Music Nerd profile is approved 🎉");
  });
});
