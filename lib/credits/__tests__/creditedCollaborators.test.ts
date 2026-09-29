import { describe, it, expect } from "vitest";
import { creditedCollaborators } from "@/lib/credits/creditedCollaborators";
import { verifyClaims } from "@/lib/credits/verifyClaims";
import { ARTIST, HANDLE, OTHER_URL, POST_URL, credit, post } from "@/lib/credits/__tests__/post";

describe("creditedCollaborators", () => {
  it("never draws an edge from the artist to themselves", () => {
    const extraction = verifyClaims(
      {
        credits: [
          credit(),
          credit({
            subject: "Pharaoh Sistare",
            isHandle: false,
            role: "Written & Produced by",
            quote: "Written & Produced by: Pharaoh Sistare",
          }),
        ],
        statements: [],
      },
      [post()],
      ARTIST,
      HANDLE,
    );
    expect(creditedCollaborators(extraction).map(c => c.subject)).toEqual(["p3t3rango"]);
  });

  it("merges every role a person has been given, across posts", () => {
    const p2 = post({ url: OTHER_URL, platformPostId: "2", caption: "Mixed by @p3t3rango" });
    const extraction = verifyClaims(
      {
        credits: [
          credit(),
          credit({ url: OTHER_URL, role: "Mixed by", quote: "Mixed by @p3t3rango" }),
        ],
        statements: [],
      },
      [post(), p2],
      ARTIST,
      HANDLE,
    );
    const [c] = creditedCollaborators(extraction);
    expect(c.subject).toBe("p3t3rango");
    expect(c.roles).toEqual(["Mixing & Mastering Engineer", "Mixed by"]);
    expect(c.evidenceUrls).toEqual([POST_URL, OTHER_URL]);
    expect(c.recurringRoles).toEqual([]);
  });

  it("ranks by how many posts credit each person", () => {
    const p2 = post({
      url: OTHER_URL,
      platformPostId: "2",
      caption: "Shot by @shesjasminmarie and mixed by @p3t3rango",
      mentions: ["shesjasminmarie", "p3t3rango"],
    });
    const extraction = verifyClaims(
      {
        credits: [
          credit(),
          credit({ url: OTHER_URL, role: "mixed by", quote: "mixed by @p3t3rango" }),
          credit({
            url: OTHER_URL,
            subject: "shesjasminmarie",
            role: "Shot by",
            quote: "Shot by @shesjasminmarie",
          }),
        ],
        statements: [],
      },
      [post(), p2],
      ARTIST,
      HANDLE,
    );
    expect(creditedCollaborators(extraction).map(c => c.subject)).toEqual([
      "p3t3rango",
      "shesjasminmarie",
    ]);
  });

  it("calls a role recurring only when it was given on two or more posts, and upgrades to a handle", () => {
    const base = { isSelf: false, quote: "q" };
    const out = creditedCollaborators({
      credits: [
        { ...base, subject: "Alan", isHandle: false, role: "production partner", url: "a" },
        { ...base, subject: "alan", isHandle: true, role: "Production Partner", url: "b" },
        { ...base, subject: "alan", isHandle: true, role: "added some 808s", url: "b" },
        { ...base, subject: "alan", isHandle: true, role: "added some 808s", url: "b" },
      ],
      statements: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      subject: "alan",
      isHandle: true,
      roles: ["production partner", "added some 808s"],
      recurringRoles: ["production partner"],
      quotes: ["q"],
      evidenceUrls: ["a", "b"],
    });
  });
});
