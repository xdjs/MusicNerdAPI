import { describe, it, expect, vi, beforeEach } from "vitest";

const getSocialCredits = vi.fn();
vi.mock("@/lib/credits/getSocialCredits", () => ({
  getSocialCredits: (...a: unknown[]) => getSocialCredits(...a),
}));
const { captionCreditSources } = await import("@/lib/lore/captionCreditSources");

const credit = (subject: string, role: string, url: string, isSelf = false) => ({
  subject,
  isHandle: true,
  role,
  quote: `${role} ${subject}`,
  url,
  isSelf,
});

beforeEach(() => getSocialCredits.mockReset());

describe("captionCreditSources", () => {
  it("cites credited collaborators, self-credits and statements from the stored extraction", async () => {
    getSocialCredits.mockResolvedValueOnce({
      credits: [
        credit("someone", "Mixed by", "u1"),
        credit("someone", "Mastered by", "u2"),
        credit("nova", "Producer", "u3", true),
      ],
      statements: [{ topic: "his mother", quote: "Mom taught us", url: "u4" }],
    });
    expect(await captionCreditSources("a1")).toEqual({
      creditedCollaborators: [
        { subject: "someone", isHandle: true, roles: ["Mixed by", "Mastered by"], url: "u1" },
      ],
      selfCredits: [{ role: "Producer", url: "u3" }],
      artistStatements: [{ topic: "his mother", quote: "Mom taught us", url: "u4" }],
    });
  });

  it("caps each kind", async () => {
    getSocialCredits.mockResolvedValueOnce({
      credits: [
        ...Array.from({ length: 6 }, (_, i) => credit(`p${i}`, "Bass", `c${i}`)),
        ...Array.from({ length: 8 }, (_, i) => credit("nova", `Role${i}`, `s${i}`, true)),
      ],
      statements: Array.from({ length: 15 }, (_, i) => ({
        topic: `t${i}`,
        quote: "q",
        url: `q${i}`,
      })),
    });
    const out = await captionCreditSources("a1");
    expect(out.creditedCollaborators).toHaveLength(4);
    expect(out.selfCredits).toHaveLength(6);
    expect(out.artistStatements).toHaveLength(12);
  });

  it("is empty, not a failure, when the credits cannot be read", async () => {
    getSocialCredits.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await captionCreditSources("a1")).toEqual({
      creditedCollaborators: [],
      selfCredits: [],
      artistStatements: [],
    });
  });
});
