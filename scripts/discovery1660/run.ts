import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { db } from "@/lib/db/db";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { saveDiscoveredLinkSuggestion } from "@/lib/artistLinkReview/saveDiscoveredLinkSuggestion";
import { setDiscoveredArtistLink } from "@/lib/artistLinkReview/setDiscoveredArtistLink";
import { reviewArtistLinkSuggestion } from "@/lib/artistLinkReview/reviewArtistLinkSuggestion";
import { getArtistLinkSuggestions } from "@/lib/artistLinkReview/getArtistLinkSuggestions";

// Keep dependency/driver failures from emitting SQL parameters in public CI logs.
console.error = () => console.log("[1660] dependency failure details suppressed");
let stage = "target-check";
async function main() {
  // Manual, one-fixture acceptance only. No model/provider calls or grants.
  const hash = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
  const connection = new URL(process.env.SUPABASE_DB_CONNECTION ?? "");
  // Pooler usernames include the project reference; direct hosts include it instead.
  const projectRef =
    decodeURIComponent(connection.username).split(".")[1] ?? connection.hostname.split(".")[1];
  assert.equal(hash(projectRef), process.env.DISCOVERY1660_TARGET_HASH, "Wrong test database");
  const preflight = process.env.DISCOVERY1660_APPROVED === "read-only-preflight";
  assert.ok(preflight || process.env.DISCOVERY1660_APPROVED === "one-disposable-dev-fixture");
  stage = "app-role-connection";
  const [{ role }] = await db.execute<{ role: string }>(sql`select current_user as role`);
  if (preflight) {
    const [facts] = await db.execute(
      sql`select current_user as role,session_user as session_role,rolsuper,rolbypassrls,has_table_privilege(current_user,'public.ugcresearch','SELECT') as can_read_suggestions,has_table_privilege(current_user,'public.ugcresearch','INSERT') as can_insert_suggestions,has_table_privilege(current_user,'public.ugcresearch','UPDATE') as can_update_suggestions,has_table_privilege(current_user,'public.artists','UPDATE') as can_update_artists,has_table_privilege(current_user,'public.artist_activity_events','INSERT') as can_insert_audit from pg_roles where rolname=current_user`,
    );
    console.log(JSON.stringify({ mode: "read-only-preflight", facts }));
    process.exit(0);
  }
  stage = "app-role-identity";
  assert.equal(role, "mnweb", "Must use real application role");
  stage = "evidence-column-read";
  const [column] = await db.execute(
    sql`select 1 from information_schema.columns where table_schema='public' and table_name='ugcresearch' and column_name='discovery_evidence' and data_type='jsonb' and is_nullable='YES'`,
  );
  assert.ok(column, "Approved evidence migration missing");
  if (process.argv.includes("--cleanup")) {
    const out = "discovery1660-results";
    if (!existsSync(`${out}/intent.json`)) {
      console.log("No fixture insert attempted");
      process.exit(0);
    }
    const { artistId, name } = JSON.parse(readFileSync(`${out}/intent.json`, "utf8"));
    const evidence = readFileSync(`${out}/evidence.json`, "utf8");
    assert.equal(hash(evidence), readFileSync(`${out}/evidence.sha256`, "utf8"));
    const snapshot = JSON.parse(evidence);
    assert.equal(snapshot.artist[0]?.id, artistId);
    assert.equal(snapshot.artist[0]?.name, name);
    await db.transaction(async tx => {
      const [guard] = await tx.execute(
        sql`select id from artists where id=${artistId}::uuid and name=${name} for update`,
      );
      assert.ok(guard);
      await tx.execute(sql`delete from ugcresearch where artist_id=${artistId}::uuid`);
      await tx.execute(sql`delete from artists where id=${artistId}::uuid and name=${name}`);
    });
    const [remaining] = await db.execute<{ count: number }>(
      sql`select (select count(*) from artists where id=${artistId}::uuid)+(select count(*) from ugcresearch where artist_id=${artistId}::uuid)+(select count(*) from artist_activity_events where artist_id=${artistId}::uuid) as count`,
    );
    assert.equal(Number(remaining.count), 0, "Cleanup incomplete");
    writeFileSync(
      `${out}/cleanup.json`,
      JSON.stringify({ fixtureId: artistId, remaining: 0, evidenceSha256: hash(evidence) }),
    );
    console.log("Exact fixture cleanup verified");
    process.exit(0);
  }
  stage = "existing-admin-read";
  const admins = await db.execute<{ id: string }>(
    sql`select id from users where username='Pete Rango' and is_admin=true`,
  );
  assert.equal(admins.length, 1, "Need unambiguous existing authorized admin");
  const userId = admins[0].id;
  stage = "public-identity-read";
  const originals = await db.execute<{ name: string; instagram: string; x: string }>(
    sql`select name,instagram,x from artists where lower(name)='pete rango'`,
  );
  assert.equal(originals.length, 1, "Need unambiguous original public identity");
  const instagram = originals[0].instagram || process.env.DISCOVERY1660_PUBLIC_INSTAGRAM;
  assert.ok(
    instagram && /^[A-Za-z0-9._]+$/.test(instagram) && originals[0].x,
    "Need verified public Instagram/X handles",
  );
  stage = "public-handle-validation";
  const artistId = randomUUID();
  const name = `Pete Rango — disposable #1660 acceptance ${artistId.slice(0, 8)}`;
  const out = "discovery1660-results";
  mkdirSync(out, { recursive: true });
  const checks: string[] = [];
  let attempted = false;
  let failed = false;
  const asAdmin = <T>(fn: () => T) =>
    withArtistOperation(
      artistId,
      { userId, expectedClaimId: null, trigger: "artist_link_review" },
      fn,
    );
  const profiles = [
    {
      siteName: "instagram",
      value: instagram,
      profileUrl: `https://www.instagram.com/${instagram}/`,
    },
    { siteName: "x", value: originals[0].x, profileUrl: `https://x.com/${originals[0].x}` },
  ];
  try {
    writeFileSync(
      `${out}/intent.json`,
      JSON.stringify({ artistId, name, sha: process.env.GITHUB_SHA }),
    );
    console.log(JSON.stringify({ fixtureIntent: { artistId, name, sha: process.env.GITHUB_SHA } }));
    attempted = true;
    await db.execute(sql`insert into artists(id,name) values(${artistId}::uuid,${name})`);

    for (const p of profiles) {
      const candidate = {
        ...p,
        discoveryEvidence: {
          version: 1 as const,
          method: "name_web_search" as const,
          artistName: originals[0].name,
          sourceUrl: p.profileUrl,
          observedTitle: null,
        },
      };
      // Explicitly controlled replay: observed public URL, not a claim we ran a search.
      await asAdmin(() => saveDiscoveredLinkSuggestion(artistId, candidate));
      await asAdmin(() => saveDiscoveredLinkSuggestion(artistId, candidate));
    }
    let list = await getArtistLinkSuggestions(artistId, userId);
    assert.equal(list.items.length, 2);
    assert.ok(
      list.items.every(x => x.status === "pending" && x.evidence?.artistName === "Pete Rango"),
    );
    checks.push("actual app-role insert/read, evidence persists, duplicate replay stays two rows");
    const ig = list.items.find(x => x.platform === "instagram")!;
    const xp = list.items.find(x => x.platform === "x")!;
    await asAdmin(() =>
      reviewArtistLinkSuggestion(artistId, userId, { kind: "ugc", id: ig.id, decision: "dismiss" }),
    );
    assert.equal(await asAdmin(() => saveDiscoveredLinkSuggestion(artistId, profiles[0])), false);
    assert.equal(
      await asAdmin(() =>
        saveDiscoveredLinkSuggestion(
          artistId,
          { ...profiles[0], value: profiles[0].value.toUpperCase() },
          false,
        ),
      ),
      false,
    );
    await assert.rejects(
      () => asAdmin(() => setDiscoveredArtistLink(artistId, "instagram", profiles[0].value)),
      /explicit confirmation/,
    );
    checks.push(
      "rejection survives repeat, casing and stronger-match replay; auto attachment blocked",
    );
    // Unknown account must fail specifically authorization while target is still pending.
    await assert.rejects(
      () =>
        reviewArtistLinkSuggestion(artistId, randomUUID(), {
          kind: "ugc",
          id: xp.id,
          decision: "approve",
        }),
      (error: unknown) => error instanceof OwnershipChangedError,
    );
    const beforeApproval = await getArtistLinkSuggestions(artistId, userId);
    assert.equal(beforeApproval.items.find(x => x.id === xp.id)?.status, "pending");
    const [unchanged] = await db.execute<{ x: string | null }>(
      sql`select x from artists where id=${artistId}::uuid`,
    );
    assert.equal(unchanged.x, null);
    checks.push(
      "unknown account rejected specifically by authorization; pending status and artist link unchanged",
    );
    await asAdmin(() =>
      reviewArtistLinkSuggestion(artistId, userId, { kind: "ugc", id: xp.id, decision: "approve" }),
    );
    list = await getArtistLinkSuggestions(artistId, userId);
    assert.equal(list.items.find(x => x.id === ig.id)?.status, "rejected");
    assert.equal(list.items.find(x => x.id === xp.id)?.status, "approved");
    const [stored] = await db.execute<{ instagram: string | null; x: string }>(
      sql`select instagram,x from artists where id=${artistId}::uuid`,
    );
    assert.equal(stored.instagram, null);
    assert.equal(stored.x, profiles[1].value);
    await assert.rejects(
      () =>
        asAdmin(() =>
          reviewArtistLinkSuggestion(artistId, userId, {
            kind: "ugc",
            id: xp.id,
            decision: "approve",
          }),
        ),
      /already been reviewed/,
    );
    checks.push(
      "approve attaches only fixture X; repeat approval rejected; both decisions survive reload",
    );
  } catch (e) {
    failed = true;
    // Do not dump SQL errors, connection values or real account IDs into public logs.
    checks.push(
      `FAILED: ${e instanceof assert.AssertionError ? "assertion" : "runtime"}; inspect bounded fixture evidence`,
    );
  } finally {
    if (attempted) {
      const artists = await db.execute(
        sql`select id,name,instagram,x from artists where id=${artistId}::uuid and name=${name}`,
      );
      assert.equal(artists.length, 1, "Fixture guard failed; stop cleanup");
      const suggestions = await db.execute(
        sql`select id,artist_id,ugc_url,site_name,site_username,origin,accepted,date_processed,created_at,updated_at,discovery_evidence from ugcresearch where artist_id=${artistId}::uuid`,
      );
      const events = await db.execute(
        sql`select id,artist_id,actor_kind,action,trigger,source_id,parent_activity_id,created_at from artist_activity_events where artist_id=${artistId}::uuid`,
      );
      assert.ok(
        suggestions.length <= 2 && events.length <= 2,
        "Unexpected fixture growth; stop cleanup",
      );
      const evidence = JSON.stringify(
        {
          artist: artists,
          suggestions,
          events,
          actor: "existing authorized Pete Rango admin; ID not exported",
          checks,
          source:
            "controlled replay using saved X and public Music Nerd footer Instagram, not live provider search",
          sha: process.env.GITHUB_SHA,
        },
        null,
        2,
      );
      writeFileSync(`${out}/evidence.json`, evidence);
      assert.equal(readFileSync(`${out}/evidence.json`, "utf8"), evidence);
      writeFileSync(`${out}/evidence.sha256`, hash(evidence));
      writeFileSync(
        `${out}/cleanup-pending.json`,
        JSON.stringify({ artistId, name, status: "awaiting durable artifact upload" }),
      );
    }
  }
  console.log(JSON.stringify({ passed: !failed, checks, fixtureAwaitingCleanup: attempted }));
  process.exit(failed ? 1 : 0);
}
main().catch(() => {
  console.log(
    `[1660] stopped safely at ${stage}; inspect bounded artifact and verify fixture cleanup before retry`,
  );
  process.exit(1);
});
