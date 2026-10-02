import { describe, it, expect, vi, beforeEach } from "vitest";

const { wait, grounded } = vi.hoisted(() => ({ wait: vi.fn(), grounded: vi.fn() }));
vi.mock("@/lib/instagram/waitForSocialPosts", () => ({ waitForSocialPosts: wait }));
vi.mock("@/lib/questions/generateGroundedQuestions", () => ({
  generateGroundedQuestions: grounded,
}));
const { buildInterviewQuestions } = await import("@/lib/onboarding/buildInterviewQuestions");

beforeEach(() => {
  wait.mockReset().mockResolvedValue(true);
  grounded.mockReset().mockResolvedValue([]);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("buildInterviewQuestions", () => {
  it("puts grounded questions first, then fills with static ones, up to three", async () => {
    grounded.mockResolvedValueOnce([
      {
        key: "social_credit_a",
        question: "Who played bass?",
        sourceUrls: ["https://ig/p/1"],
        kind: "credit",
        rationale: "",
      },
    ]);
    expect(await buildInterviewQuestions("a1")).toEqual([
      { key: "social_credit_a", question: "Who played bass?", sourceUrls: ["https://ig/p/1"] },
      {
        key: "sound_in_own_words",
        question: "How would you describe your sound, in your own words?",
        sourceUrls: [],
      },
      {
        key: "offline_fact",
        question: "What's something fans should know about you that isn't written anywhere online?",
        sourceUrls: [],
      },
    ]);
    expect(wait).toHaveBeenCalledWith("a1", 8_000);
    expect(grounded).toHaveBeenCalledWith("a1", { max: 3 });
  });

  it("asks the static questions when there are no posts or generation fails", async () => {
    wait.mockResolvedValueOnce(false);
    expect((await buildInterviewQuestions("a1")).map(q => q.key)).toEqual([
      "sound_in_own_words",
      "offline_fact",
      "working_on_now",
    ]);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    grounded.mockRejectedValueOnce(new Error("gemini"));
    expect(await buildInterviewQuestions("a1")).toHaveLength(3);
    error.mockRestore();
  });
});
