import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { assertDirectoryDiscoveryScope } from "../assertDirectoryDiscoveryScope";
const client = new PGlite();
const tx = drizzle(client);
const artist = "00000000-0000-4000-8000-000000000001";
const event = "00000000-0000-4000-8000-000000000002";
const user = "00000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  await client.exec(
    `create table artists(id uuid,added_by uuid);create table artist_activity_events(id uuid,artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text);create table artist_claims(artist_id uuid,status text);insert into artists values('${artist}','${user}');insert into artist_activity_events values('${event}','${artist}','${user}','user','directory_add','directory_add');`,
  );
});
afterAll(() => client.close());
it("authorizes only the original adder event and stops permanently when a claim begins", async () => {
  await expect(assertDirectoryDiscoveryScope(tx as never, artist, event)).resolves.toBeUndefined();
  await expect(assertDirectoryDiscoveryScope(tx as never, artist, user)).rejects.toThrow(
    "ownership changed",
  );
  await client.exec(`update artist_activity_events set actor_user_id=null`);
  await expect(assertDirectoryDiscoveryScope(tx as never, artist, event)).rejects.toThrow(
    "ownership changed",
  );
  await client.exec(
    `update artist_activity_events set actor_user_id='${user}';insert into artist_claims values('${artist}','pending')`,
  );
  await expect(assertDirectoryDiscoveryScope(tx as never, artist, event)).rejects.toThrow(
    "ownership changed",
  );
  await client.exec(`update artist_claims set status='rejected'`);
  await expect(assertDirectoryDiscoveryScope(tx as never, artist, event)).rejects.toThrow(
    "ownership changed",
  );
});
