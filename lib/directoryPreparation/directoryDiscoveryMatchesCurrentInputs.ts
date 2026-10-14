import { sql } from "drizzle-orm";
/** Shared predicate for job alias j and artist alias a; discovery time never advances on child retries. */
export function directoryDiscoveryMatchesCurrentInputs() {
  return sql`
    j.state->'directoryDiscovery'->'version'='1'::jsonb
    and case when jsonb_typeof(j.state->'directoryDiscovery'->'completedAt')='number'
      then (j.state->'directoryDiscovery'->>'completedAt')::numeric end
      between extract(epoch from (now()-interval '24 hours'))*1000 and extract(epoch from now())*1000
    and j.state->'directoryDiscovery'->'identity'=jsonb_build_object('name',a.name,'spotify',a.spotify,'deezer',a.deezer)
    and j.state->'directoryDiscovery'->>'sourcesRevision'=(
      select md5(coalesce(jsonb_agg(public.knowledge_vault_source_snapshot(v)-'status'-'updatedAt' order by v.id),'[]'::jsonb)::text)
      from artist_vault_sources v where v.artist_id=a.id and v.activity_id=j.activity_id and v.origin='research')`;
}
