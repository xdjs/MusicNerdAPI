import { describe, it, expect, vi, beforeEach } from "vitest";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/generateArray", () => ({ generateArray: generate }));
const { judgeSourceRelevance } = await import("@/lib/relevance/judgeSourceRelevance");

const ANCHOR = {
  name: "Black Dave",
  catalog: ["Worst Generation", "Anime Rap"],
  identifiers: ["instagram: blackdave.xyz"],
};
const page = (url: string, text: string | null, title = "t") => ({ url, title, text });

beforeEach(() => {
  generate.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("judgeSourceRelevance", () => {
  it("rejects a namesake and affirms the artist", async () => {
    generate.mockResolvedValue({
      output: [
        { i: 0, v: "no" },
        { i: 1, v: "about" },
      ],
    });
    const verdicts = await judgeSourceRelevance(ANCHOR, [
      page("https://head-fi.org/chord-dave", "The Chord DAVE is a black reference DAC..."),
      page("https://example.com/real", "Black Dave released Worst Generation..."),
    ]);
    expect(verdicts.get("https://head-fi.org/chord-dave")).toBe("not-about-artist");
    expect(verdicts.get("https://example.com/real")).toBe("about-artist");
  });

  it("leaves everything undecided when the model fails or times out", async () => {
    generate.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    const verdicts = await judgeSourceRelevance(ANCHOR, [page("https://a.example/x", "body")]);
    expect(verdicts.get("https://a.example/x")).toBe("undecided");
  });

  it("does not call the model when nothing was readable", async () => {
    const verdicts = await judgeSourceRelevance(ANCHOR, [
      page("https://a.example/x", null),
      page("https://b.example/y", "  "),
    ]);
    expect(generate).not.toHaveBeenCalled();
    expect(verdicts.get("https://b.example/y")).toBe("undecided");
  });

  it("sends the anchor and numbered pages, deterministically and without thinking", async () => {
    generate.mockResolvedValue({ output: [] });
    await judgeSourceRelevance(ANCHOR, [page("https://a.example/x", "body")]);
    const req = generate.mock.calls[0][0];
    expect(req.prompt).toContain("Worst Generation");
    expect(req.prompt).toContain("blackdave.xyz");
    expect(req.prompt).toContain("--- PAGE 0 ---");
    expect(req.instructions).toContain("Never write a URL.");
    expect(req.temperature).toBe(0);
    expect(req.thinkingBudget).toBe(0);
    expect(req.element).toBeDefined();
  });

  it("judges at most 12 readable pages; the rest stay undecided", async () => {
    generate.mockResolvedValue({
      output: Array.from({ length: 14 }, (_, i) => ({ i, v: "about" })),
    });
    const pages = Array.from({ length: 14 }, (_, i) => page(`https://p${i}.example`, "text"));
    const verdicts = await judgeSourceRelevance(ANCHOR, pages);
    expect(generate.mock.calls[0][0].prompt).not.toContain("--- PAGE 12 ---");
    expect(verdicts.get("https://p11.example")).toBe("about-artist");
    expect(verdicts.get("https://p12.example")).toBe("undecided");
  });
});
