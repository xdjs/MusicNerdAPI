import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, ids } from "@/lib/contributions/__tests__/testDb";

const test = await createTestDb();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.database;
  },
}));
const { getRecentActivity } = await import("@/lib/activityFeed/getRecentActivity");

beforeAll(async () => {
  await test.client.exec(`
insert into mcp_audit_log(artist_id,field,action,api_key_hash,created_at) values
 ('${ids.artist}','mapping:deezer','resolve','k','2026-10-20T10:00:00Z'),
 ('${ids.artist}','bio','resolve','k','2026-10-20T10:30:00Z'),
 ('${ids.artist}','mapping:tidal','propose','k','2026-10-20T10:40:00Z');
insert into ugcresearch(artist_id,name,site_name,accepted,date_processed,updated_at,user_id) values
 ('${ids.artist}','Bio Ritmo','bandcamp',true,'2026-10-20T11:00:00Z','2026-10-20T11:00:00Z','${ids.user}'),
 ('${ids.artist}','Bio Ritmo','instagram',false,null,'2026-10-20T12:00:00Z','${ids.user}'),
 ('${ids.artist}','Bio Ritmo','x',true,null,'2026-10-20T12:30:00Z','${ids.user}');
insert into artist_self_edits(artist_id,user_id,site_name,old_value,new_value,submitted_url,created_at) values
 ('${ids.artist}','${ids.user}','instagram',null,'bioritmomusic','https://instagram.com/bioritmomusic','2026-10-20T09:00:00Z'),
 ('${ids.artist}','${ids.user}','instagram','bioritmomusic','bioritmo','https://instagram.com/bioritmo','2026-10-20T13:00:00Z');`);
});
afterAll(async () => test.client.close());

describe("getRecentActivity", () => {
  it("merges the four sources newest first, keeping only resolved mappings and moderated approvals", async () => {
    const events = await getRecentActivity();
    expect(events.map(e => [e.type, e.platform])).toEqual([
      ["self_edit_updated", "instagram"],
      ["ugc_approved", "bandcamp"],
      ["agent_mapping", "mapping:deezer"],
      ["self_edit_added", "instagram"],
      ["artist_added", null],
      ["artist_added", null],
    ]);
    expect(events[0]).toMatchObject({ artist_id: ids.artist, artist_name: "Bio Ritmo" });
    expect(events[4]).toMatchObject({ artist_id: ids.otherArtist, artist_name: "Celia Cruz" });
  });

  it("returns only events after `since`, and honours the limit", async () => {
    const since = await getRecentActivity("2026-10-20T10:30:00Z");
    expect(since.map(e => e.type)).toEqual(["self_edit_updated", "ugc_approved"]);
    expect(await getRecentActivity(undefined, 2)).toHaveLength(2);
  });
});
