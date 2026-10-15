import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
const client = new PGlite();
const driver = drizzle(client);
const m = vi.hoisted(() => ({ build: vi.fn(), scope: vi.fn() }));
vi.mock("@/lib/onboarding/buildInterviewQuestions", () => ({ buildInterviewQuestions: m.build }));
vi.mock("@/lib/ownership/getArtistOperationOwnership", () => ({
  getArtistOperationOwnership: m.scope,
}));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({
  withScopedArtistWrite: async (_id: string, write: (tx: unknown) => unknown) =>
    driver.transaction(tx => Promise.resolve(write(tx))),
}));
const { getOnboardingInterviewPlan } = await import("../getOnboardingInterviewPlan");
const artist = "00000000-0000-4000-8000-000000000001";
const claim = "00000000-0000-4000-8000-000000000002";
const questions = [
  {
    key: "social_first",
    question: "What changed during recording?",
    sourceUrls: ["https://example.com/post"],
  },
  { key: "offline_fact", question: "Anything else?", sourceUrls: [] },
];
beforeAll(() =>
  client.exec(
    "create table artist_onboarding_interview_plans(artist_id uuid primary key,claim_id uuid,questions jsonb not null,created_at timestamptz default now())",
  ),
);
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec("truncate artist_onboarding_interview_plans");
  m.scope.mockReturnValue({ userId: "u", expectedClaimId: claim });
  m.build.mockReset().mockResolvedValue(questions);
});
it("persists one plan and restores identical wording/citations after an answer, skip or restart", async () => {
  expect(await getOnboardingInterviewPlan(artist, [])).toEqual(questions);
  m.build.mockRejectedValue(new Error("Provider is now down"));
  expect(await getOnboardingInterviewPlan(artist, ["social_first"])).toEqual(questions);
  expect(await getOnboardingInterviewPlan(artist, ["social_first", "offline_fact"])).toEqual(
    questions,
  );
  expect(m.build).toHaveBeenCalledTimes(1);
  expect((await client.query("select * from artist_onboarding_interview_plans")).rows).toHaveLength(
    1,
  );
});
it("keeps a fallback plan instead of regenerating after each skip", async () => {
  m.build.mockResolvedValue([
    { key: "sound_in_own_words", question: "Your sound?", sourceUrls: [] },
  ]);
  await getOnboardingInterviewPlan(artist, []);
  await getOnboardingInterviewPlan(artist, ["sound_in_own_words"]);
  expect(m.build).toHaveBeenCalledTimes(1);
});
it("replaces a stale claim plan and refuses an unscoped operation", async () => {
  await getOnboardingInterviewPlan(artist, []);
  m.scope.mockReturnValue({
    userId: "other",
    expectedClaimId: "00000000-0000-4000-8000-000000000003",
  });
  m.build.mockResolvedValue(questions.slice(1));
  expect(await getOnboardingInterviewPlan(artist, [])).toEqual(questions.slice(1));
  m.scope.mockReturnValue(undefined);
  await expect(getOnboardingInterviewPlan(artist, [])).rejects.toThrow();
});
it("adopts the first concurrently saved plan", async () => {
  let finish!: (value: typeof questions) => void;
  m.build.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const slow = getOnboardingInterviewPlan(artist, []);
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  const fast = await getOnboardingInterviewPlan(artist, []);
  finish(questions.slice(1));
  expect(await slow).toEqual(fast);
});
it("does not disguise a corrupt saved plan as a new interview", async () => {
  await client.query("insert into artist_onboarding_interview_plans values($1,$2,'{}',now())", [
    artist,
    claim,
  ]);
  await expect(getOnboardingInterviewPlan(artist, [])).rejects.toThrow();
  expect(m.build).not.toHaveBeenCalled();
});
