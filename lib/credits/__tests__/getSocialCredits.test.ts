import { describe, it, expect, vi, beforeEach } from "vitest";

const where = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({
  db: { select: () => ({ from: () => ({ where: (...a: unknown[]) => where(...a) }) }) },
}));
const { getSocialCredits } = await import("@/lib/credits/getSocialCredits");

const rows = [
  {
    kind: "credit",
    subject: "zavodskyalan",
    isHandle: true,
    isSelf: false,
    label: "breath church",
    quote:
      "Then I went to NY to do my very first @breath.church with @sage.breath and the boys @zavodskyalan",
    sourceUrl: "https://www.instagram.com/p/A/",
    postedAt: null,
  },
  {
    kind: "credit",
    subject: "zavodskyalan",
    isHandle: true,
    isSelf: false,
    label: "main production partner",
    quote: "He has been one of my main production partners for years now",
    sourceUrl: "https://www.instagram.com/p/B/",
    postedAt: "2025-01-01T00:00:00+00:00",
  },
  {
    kind: "credit",
    subject: null,
    isHandle: false,
    isSelf: false,
    label: "Mixed by",
    quote: "Mixed by",
    sourceUrl: "https://www.instagram.com/p/D/",
    postedAt: null,
  },
  {
    kind: "statement",
    subject: null,
    isHandle: false,
    isSelf: false,
    label: "the pandemic",
    quote: "a blessing and a curse",
    sourceUrl: "https://www.instagram.com/p/C/",
    postedAt: null,
  },
];

beforeEach(() => {
  where.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getSocialCredits", () => {
  it("reads rows back as an extraction, dropping stored roles that are somebody else's handle", async () => {
    where.mockResolvedValueOnce(rows);
    const out = await getSocialCredits("a1");
    expect(out.credits).toEqual([
      {
        subject: "zavodskyalan",
        isHandle: true,
        role: "main production partner",
        quote: "He has been one of my main production partners for years now",
        url: "https://www.instagram.com/p/B/",
        isSelf: false,
        postedAt: "2025-01-01T00:00:00+00:00",
      },
    ]);
    expect(out.statements).toEqual([
      {
        quote: "a blessing and a curse",
        topic: "the pandemic",
        url: "https://www.instagram.com/p/C/",
        postedAt: null,
      },
    ]);
  });

  it("is empty on a database error or without an artist", async () => {
    where.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getSocialCredits("a1")).toEqual({ credits: [], statements: [] });
    expect(await getSocialCredits("")).toEqual({ credits: [], statements: [] });
  });
});
