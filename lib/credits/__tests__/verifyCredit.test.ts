import { describe, it, expect, vi } from "vitest";
import { verifyCredit } from "@/lib/credits/verifyCredit";
import { ARTIST, HANDLE, OTHER_URL, POST_URL, credit, post } from "@/lib/credits/__tests__/post";
import type { SocialPostRow } from "@/lib/instagram/types";

const check = (raw: Record<string, unknown>, p: SocialPostRow = post()) =>
  verifyCredit(raw, new Map([[p.url, p]]), ARTIST, HANDLE);

describe("verifyCredit", () => {
  it("does not turn X/TikTok collaborator handles into Instagram links", () => {
    const p = post({ platform: "x" });
    expect(verifyCredit(credit(), new Map([[p.url, p]]), ARTIST, HANDLE)).toMatchObject({
      subject: "p3t3rango",
      isHandle: false,
    });
  });
  it("keeps a credit that is really in the caption", () => {
    expect(check(credit())).toMatchObject({
      subject: "p3t3rango",
      role: "Mixing & Mastering Engineer",
      isHandle: true,
      isSelf: false,
      url: POST_URL,
    });
  });

  it("drops a claim citing a post it was never given", () => {
    expect(check(credit({ url: OTHER_URL }))).toBeNull();
  });

  it("drops a quote that does not appear in that caption", () => {
    expect(check(credit({ quote: "Mastered at Abbey Road by @p3t3rango" }))).toBeNull();
  });

  it("drops a person who is neither mentioned nor named in the caption", () => {
    expect(check(credit({ subject: "someoneelse" }))).toBeNull();
  });

  it("will not accept a subject that is only a fragment of another word", () => {
    const p = post({ caption: "started this one in a hotel room", mentions: [] });
    const raw = credit({
      subject: "Art",
      isHandle: false,
      role: "Cover art by",
      quote: "started this one in a hotel room",
    });
    expect(check(raw, p)).toBeNull();
  });

  it("accepts a bare name written in the caption even with no @mention", () => {
    const p = post({ caption: "Strings by Elizabeth Owens, recorded live.", mentions: [] });
    const raw = credit({
      subject: "Elizabeth Owens",
      isHandle: true,
      role: "Strings by",
      quote: "Strings by Elizabeth Owens, recorded live.",
    });
    // The model said handle; there is no @ to see, so it is a bare name.
    expect(check(raw, p)).toMatchObject({ subject: "Elizabeth Owens", isHandle: false });
  });

  it("tolerates reflowed whitespace but not altered words", () => {
    expect(check(credit({ quote: "Mixing  &   Mastering Engineer:   @p3t3rango" }))).not.toBeNull();
    expect(check(credit({ quote: "Mixing and Mastering Engineer: @p3t3rango" }))).toBeNull();
  });

  it("strips a leading @ from the subject", () => {
    expect(check(credit({ subject: "@p3t3rango" }))?.subject).toBe("p3t3rango");
  });

  describe("self-credits", () => {
    it("marks the artist crediting themselves by name", () => {
      const raw = credit({
        subject: "Pharaoh Sistare",
        isHandle: false,
        role: "Written & Produced by",
        quote: "Written & Produced by: Pharaoh Sistare",
      });
      expect(check(raw)?.isSelf).toBe(true);
    });

    it("marks the artist crediting their own handle", () => {
      const p = post({ caption: "Mixed by @pharaohsistare", mentions: ["pharaohsistare"] });
      const raw = credit({
        subject: "pharaohsistare",
        role: "Mixed by",
        quote: "Mixed by @pharaohsistare",
      });
      expect(check(raw, p)?.isSelf).toBe(true);
    });

    it("keeps a two-letter first-person credit", () => {
      const p = post({ caption: "Shot by me", mentions: [] });
      const raw = credit({ subject: "me", isHandle: false, role: "Shot by", quote: "Shot by me" });
      expect(check(raw, p)).toMatchObject({ isSelf: true });
    });

    it("marks first-person stand-ins like 'moi' as self", () => {
      const p = post({ caption: "Produced/directed/edited by moi", mentions: [] });
      const raw = credit({
        subject: "moi",
        isHandle: false,
        role: "Produced/directed/edited by",
        quote: "Produced/directed/edited by moi",
      });
      expect(check(raw, p)?.isSelf).toBe(true);
    });
  });

  describe("roles that say nothing", () => {
    it("drops an emoji-only role", () => {
      const p = post({ caption: "📸 @bevelcut_shawti", mentions: ["bevelcut_shawti"] });
      expect(
        check(credit({ subject: "bevelcut_shawti", role: "📸", quote: "📸 @bevelcut_shawti" }), p),
      ).toBeNull();
    });

    it("drops a role that is a clause rather than a job", () => {
      const caption =
        "Thank you @p00ls_ for helping artists explore ways to reward communities on-chain.";
      const p = post({ caption, mentions: ["p00ls_"] });
      const raw = credit({
        subject: "p00ls_",
        role: "helping artists explore ways to reward communities on-chain",
        quote: caption,
      });
      expect(check(raw, p)).toBeNull();
    });

    it("drops a role written in the first person", () => {
      const caption = "@subvertworld is a co-op music platform I joined as a founding member";
      const p = post({ caption, mentions: ["subvertworld"] });
      expect(
        check(credit({ subject: "subvertworld", role: "platform I joined", quote: caption }), p),
      ).toBeNull();
    });

    it("keeps the real credits that motivated the bound", () => {
      for (const [role, caption] of [
        ["Mixing & Mastering Engineer", "Mixing & Mastering Engineer: @p3t3rango"],
        ["Mastered by", "Mastered by @p3t3rango"],
        ["on guitar", "on guitar @p3t3rango"],
        ["Bass", "Bass @p3t3rango"],
      ] as const) {
        const p = post({ caption, mentions: ["p3t3rango"] });
        expect(check(credit({ role, quote: caption }), p)?.role).toBe(role);
      }
    });

    it("drops a role that is only a preposition", () => {
      const p = post({ caption: "for @ap0cene", mentions: ["ap0cene"] });
      expect(
        check(credit({ subject: "ap0cene", role: "for", quote: "for @ap0cene" }), p),
      ).toBeNull();
    });
  });

  it("drops a role that is really somebody else's handle", () => {
    const quote = "Then I went to NY to do my very first @breath.church with @sage.breath";
    const p = post({ caption: quote, mentions: ["breath.church", "sage.breath"] });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(
      check(credit({ subject: "sage.breath", role: "first @breath.church", quote }), p),
    ).toBeNull();
    log.mockRestore();
  });

  it("drops a claim missing a field or with non-string fields", () => {
    expect(check(credit({ quote: 7 }))).toBeNull();
    expect(check(credit({ subject: "" }))).toBeNull();
  });
});
