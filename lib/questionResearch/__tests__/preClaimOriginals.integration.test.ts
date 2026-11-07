import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
const client = new PGlite();
const driver = drizzle(client);
const store = {
  execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
};
vi.mock("@/lib/db/db", () => ({
  db: { execute: store.execute, transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(store) },
}));
vi.mock("@/lib/questionResearch/loadPublicLatestOriginals", () => ({
  loadPublicLatestOriginals: async () => [],
}));
vi.mock("@/lib/latestProviders/getStoredLatestProviders", () => ({
  getStoredLatestProviders: async () => ({ originals: [] }),
}));
const { loadPublicResearchOriginals } =
  await import("@/lib/questionResearch/loadPublicResearchOriginals");
const artist = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await client.exec(`
    create table artist_activity_events(id uuid,artist_id uuid,source_id uuid,actor_kind text,actor_user_id uuid,trigger text,action text);
 create table artist_claims(artist_id uuid,status text);
    create table artist_vault_sources(id uuid,artist_id uuid,status text,file_path text,snapshot jsonb,file_name text,file_size integer,content_type text,activity_id uuid,origin text);
    create table artist_social_posts(artist_id uuid,is_own_post boolean,raw jsonb,snapshot jsonb);
    create table artist_research_candidates(id uuid,artist_id uuid,current_revision text,identity text,curation text,reviewed_revision text,destination text,source_id uuid,platform text,platform_id text,url text);
    create table artist_research_evidence(id uuid,candidate_id uuid,artist_id uuid,revision text,original_text text,provenance jsonb,retrieved_at timestamptz,title text);
    create table artists(id uuid);
    create function knowledge_vault_source_snapshot(v artist_vault_sources) returns jsonb language sql as 'select v.snapshot';
    create function knowledge_social_post_snapshot(s artist_social_posts) returns jsonb language sql as 'select s.snapshot';
  `);
  const vault = {
    version: 1,
    kind: "vault",
    id: "00000000-0000-4000-8000-000000000002",
    artistId: artist,
    url: "https://example.com/interview",
    status: "approved",
    origin: "research",
    type: "article",
    filePath: null,
    title: "Interview",
    snippet: null,
    extractedText: "Private prepared evidence",
    publishedAt: null,
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: null,
  };
  const social = {
    version: 1,
    kind: "social",
    id: "00000000-0000-4000-8000-000000000003",
    artistId: artist,
    url: "https://instagram.com/p/example",
    platform: "instagram",
    ownerUsername: "example",
    isOwnPost: true,
    caption: "Public caption remains accessible",
    postedAt: "2026-10-12T00:00:00Z",
    transcript: null,
    isRepost: false,
    isRetweet: false,
  };
  await client.query("insert into artist_vault_sources values($1,$2,'approved',null,$3)", [
    vault.id,
    artist,
    JSON.stringify(vault),
  ]);
  await client.query("insert into artist_social_posts values($1,true,'{}',$2)", [
    artist,
    JSON.stringify(social),
  ]);
  await client.exec(
    "alter table artist_vault_sources add column publication text not null default 'inherit'",
  );
  await client.exec(
    "alter table artist_vault_sources add column url text; update artist_vault_sources set url=snapshot->>'url'",
  );
}, 30000);
afterAll(async () => client.close());
it("keeps public social originals but hides stored Lore until claim and again after revocation", async () => {
  expect((await loadPublicResearchOriginals(artist)).map(s => s.text)).toEqual([
    "Public caption remains accessible",
  ]);
  await client.query("insert into artist_claims values($1,'approved')", [artist]);
  expect((await loadPublicResearchOriginals(artist)).map(s => s.text)).toContain(
    "Private prepared evidence",
  );
  await client.exec("update artist_claims set status='rejected'");
  expect((await loadPublicResearchOriginals(artist)).map(s => s.text)).toEqual([
    "Public caption remains accessible",
  ]);
});

it("publishes only explicitly public approved originals without fabricating a claim", async () => {
  await client.exec(
    "delete from artist_claims; update artist_vault_sources set publication='public'",
  );
  expect(
    (await loadPublicResearchOriginals(artist)).some(s => s.sourceId.startsWith("vault:")),
  ).toBe(true);
  await client.exec(
    "update artist_vault_sources set publication='private'; insert into artist_claims values ('00000000-0000-4000-8000-000000000001','approved')",
  );
  expect(
    (await loadPublicResearchOriginals(artist)).some(s => s.sourceId.startsWith("vault:")),
  ).toBe(false);
  for (const status of ["pending", "rejected"]) {
    await client.query("update artist_vault_sources set publication='public',status=$1", [status]);
    expect(
      (await loadPublicResearchOriginals(artist)).some(s => s.sourceId.startsWith("vault:")),
    ).toBe(false);
  }
});

it("revalidates publication and source revision before a read can emit a citation", async () => {
  const { assertPublicSourceCurrent } =
    await import("@/lib/sourcePublication/assertPublicSourceCurrent");
  const { createReadSourceTool } = await import("@/lib/chat/createReadSourceTool");
  await client.exec(
    "delete from artist_claims; update artist_vault_sources set publication='public',status='approved'",
  );
  const originals = await loadPublicResearchOriginals(artist);
  const source = originals.find(s => s.sourceId.startsWith("vault:"))!;
  const cite = vi.fn().mockReturnValue(1);
  const tool = createReadSourceTool(originals, cite, s => assertPublicSourceCurrent(artist, s));
  const context = { toolCallId: "r", messages: [], context: {} };
  await expect(tool.execute!({ sourceId: source.sourceId }, context)).resolves.toHaveProperty(
    "text",
  );
  cite.mockClear();
  await client.exec("update artist_vault_sources set publication='private'");
  await expect(tool.execute!({ sourceId: source.sourceId }, context)).rejects.toThrow(
    "no longer public",
  );
  expect(cite).not.toHaveBeenCalled();
  await client.exec(
    "update artist_vault_sources set publication='public',snapshot=jsonb_set(snapshot,'{updatedAt}','\"2026-11-03T00:00:00Z\"')",
  );
  await expect(assertPublicSourceCurrent(artist, source)).rejects.toThrow("Source changed");
});
it("discovers trusted uploaded text without a claim and rechecks moderation before reading", async () => {
  const { assertPublicSourceCurrent } =
    await import("@/lib/sourcePublication/assertPublicSourceCurrent");
  const sourceId = "00000000-0000-4000-8000-000000000002";
  await client.exec("delete from artist_claims;delete from artist_activity_events");
  await client.query(
    "update artist_vault_sources set status='approved',publication='inherit',origin='upload',file_path='a/file.txt',content_type='text/plain',activity_id=$1,snapshot=snapshot || jsonb_build_object('status','approved','origin','upload','filePath','a/file.txt','extractedText','Trusted contributed text')",
    [sourceId],
  );
  await client.query(
    "insert into artist_activity_events values($1,$2,$1,'user',$1,'trusted_submission','source_upload')",
    [sourceId, artist],
  );
  const found = (await loadPublicResearchOriginals(artist)).find(
    source => source.sourceId === `vault:${sourceId}`,
  );
  expect(found?.text).toBe("Trusted contributed text");
  await expect(assertPublicSourceCurrent(artist, found!)).resolves.toBeUndefined();
  const { createSearchSourcesTool } = await import("@/lib/chat/createSearchSourcesTool");
  const { createReadSourceTool } = await import("@/lib/chat/createReadSourceTool");
  const context = { toolCallId: "trusted-text", messages: [], context: {} };
  const discovery = await createSearchSourcesTool([found!], "Fixture", source =>
    assertPublicSourceCurrent(artist, source),
  ).execute!({ query: "contributed" }, context);
  if (!("sources" in discovery)) throw new Error("Expected ordinary discovery tool result");
  expect(discovery.sources).toHaveLength(1);
  const selected = discovery.sources[0],
    cite = vi.fn().mockReturnValue(1);
  const reader = createReadSourceTool([found!], cite, source =>
    assertPublicSourceCurrent(artist, source),
  );
  expect(
    await reader.execute!({ sourceId: selected.sourceId, locator: selected.locator }, context),
  ).toMatchObject({ text: "Trusted contributed text", n: 1 });
  cite.mockClear();
  await client.exec("update artist_vault_sources set status='rejected'");
  await expect(assertPublicSourceCurrent(artist, found!)).rejects.toThrow("no longer public");
  await expect(
    reader.execute!({ sourceId: selected.sourceId, locator: selected.locator }, context),
  ).rejects.toThrow("no longer public");
  expect(cite).not.toHaveBeenCalled();
  expect(
    (await loadPublicResearchOriginals(artist)).some(
      source => source.sourceId === `vault:${sourceId}`,
    ),
  ).toBe(false);
});
it.each([null, "a/file.txt"])(
  "never restores secret-query URLs for public links or uploaded text: %s",
  async path => {
    await client.query(
      "update artist_vault_sources set status='approved',publication='public',file_path=$1,content_type='text/plain',snapshot=snapshot || jsonb_build_object('status','approved','filePath',$1::text,'url','https://example.test/file?token=secret-fixture')",
      [path],
    );
    const originals = await loadPublicResearchOriginals(artist);
    expect(originals.some(source => source.sourceId.startsWith("vault:"))).toBe(false);
    expect(JSON.stringify(originals)).not.toContain("secret-fixture");
  },
);

const aliasEvidence = "00000000-0000-4000-8000-000000000012";
const aliasRevision = "a".repeat(64);
async function privateAlias(privateUrl: string, discoveryUrl = "https://example.com/story") {
  await client.exec(
    "delete from artist_research_evidence; delete from artist_research_candidates; delete from artist_claims",
  );
  await client.query(
    "update artist_vault_sources set status='approved',publication='private',url=$1",
    [privateUrl],
  );
  const candidate = "00000000-0000-4000-8000-000000000011";
  await client.query(
    "insert into artist_research_candidates(id,artist_id,current_revision,identity,curation,destination,url) values($1,$2,$3,'confirmed','pending','lore',$4)",
    [candidate, artist, aliasRevision, discoveryUrl],
  );
  await client.query(
    "insert into artist_research_evidence(id,candidate_id,artist_id,revision,original_text,provenance,title) values($1,$2,$3,$4,'Private alias body',$5,'Retained discovery')",
    [
      aliasEvidence,
      candidate,
      artist,
      aliasRevision,
      JSON.stringify({
        kind: "original_text",
        speaker: "unverified",
        publishedAt: null,
        retrievedAt: null,
        truncated: false,
      }),
    ],
  );
}

it("excludes retained unlinked private copies across canonical host/path/tracking aliases", async () => {
  for (const url of [
    "https://www.example.com/story/?utm_source=legacy#part",
    "https://example.com/story/",
    "https://example.com/story?fbclid=old",
  ]) {
    await privateAlias(url);
    expect(
      (await loadPublicResearchOriginals(artist)).some(
        s => s.sourceId === `discovery:${aliasEvidence}`,
      ),
    ).toBe(false);
  }
});

it("denies service reopening and source revalidation for a canonical private alias", async () => {
  await privateAlias("https://www.example.com/story/?utm_source=legacy");
  const { readResearchEvidence } = await import("../readResearchEvidence");
  await expect(
    readResearchEvidence(artist, { kind: "service" }, aliasEvidence, aliasRevision, 0, 256),
  ).rejects.toMatchObject({ status: 404 });
  const { assertPublicSourceCurrent } =
    await import("@/lib/sourcePublication/assertPublicSourceCurrent");
  await expect(
    assertPublicSourceCurrent(artist, {
      sourceId: `discovery:${aliasEvidence}`,
      revision: aliasRevision,
    } as never),
  ).rejects.toMatchObject({ status: 404 });
});

it("does not collapse meaningful edition parameters or case-sensitive paths", async () => {
  const { readResearchEvidence } = await import("../readResearchEvidence");
  for (const [hidden, visible] of [
    [
      "https://www.example.com/story/?edition=1&utm_source=x",
      "https://example.com/story?edition=2",
    ],
    ["https://example.com/Story", "https://example.com/story"],
  ]) {
    await privateAlias(hidden, visible);
    expect(
      (await loadPublicResearchOriginals(artist)).some(
        s => s.sourceId === `discovery:${aliasEvidence}`,
      ),
    ).toBe(true);
    expect(
      (
        await readResearchEvidence(
          artist,
          { kind: "service" },
          aliasEvidence,
          aliasRevision,
          0,
          256,
        )
      ).passage.text,
    ).toBe("Private alias body");
  }
});
