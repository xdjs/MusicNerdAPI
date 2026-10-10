import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
const client = new PGlite();
const driver = drizzle(client);
vi.mock("@/lib/db/db", () => ({
  get db() {
    return {
      execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
    };
  },
}));
const { getStoredPublicLatestCards } = await import("../getStoredPublicLatestCards");
const id = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await client.exec(
    `create table artist_social_posts(id text,artist_id uuid,caption text,url text,posted_at timestamptz,raw jsonb,platform text,is_own_post boolean);create table artist_interview_answers(id text,artist_id uuid,question text,answer text,created_at timestamptz,source text);create table artist_onboarding_steps(artist_id uuid,step text);`,
  );
});
afterAll(() => client.close());
it("excludes reposts, future activity, private sessions and unpublished onboarding; caps public rows", async () => {
  await client.exec(`insert into artist_social_posts select n::text,'${id}','caption','https://www.instagram.com/p/p'||n,now()-n*interval '1 day','{}','instagram',true from generate_series(1,12)n;
 insert into artist_social_posts values ('repost','${id}','wrong','https://www.instagram.com/p/repost',now(),' {"isRepost":true}','instagram',true),('future','${id}','wrong','https://www.instagram.com/p/future',now()+interval '1 day','{}','instagram',true);
 insert into artist_interview_answers select n::text,'${id}','Question','Public answer',now()-n*interval '1 day','followup' from generate_series(1,9)n;
 insert into artist_interview_answers values ('private','${id}','Private','Private words',now(),'interview'),('onboard','${id}','Unpublished','Unpublished words',now(),'onboarding');`);
  const cards = await getStoredPublicLatestCards(id, "Artist");
  expect(cards.filter(c => c.kind === "instagram")).toHaveLength(9);
  expect(cards.filter(c => c.kind === "interview")).toHaveLength(6);
  expect(JSON.stringify(cards)).not.toMatch(/Private words|Unpublished words|repost|future/);
  await client.exec(`insert into artist_onboarding_steps values('${id}','publish')`);
  expect(
    (await getStoredPublicLatestCards(id, "Artist")).find(c => c.id === "interview:onboard")?.text,
  ).toBe("Unpublished words");
});
