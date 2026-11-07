-- Inside the existing artist-locked transaction, before the unchanged
-- normal-role eligibility/revision query in assertLoreSourcesCurrent:
SELECT id FROM public.artist_vault_sources
WHERE artist_id = $1::uuid ORDER BY id FOR SHARE;
SELECT mn_private.lock_lore_activity_events($1::uuid);
-- Then execute the existing publicVaultSourceSql()/revision validation unchanged.
