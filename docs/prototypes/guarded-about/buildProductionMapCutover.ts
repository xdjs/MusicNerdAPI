/** Access-only stage inside the approved evidence/legacy transaction. Never commits. */
export function buildProductionMapCutover(operatorPreflight: string, postflight: string): string {
  return `-- Music Nerd access-only candidate. Explicit production revocation approval required.
SAVEPOINT mn_about_access_cutover;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
${operatorPreflight}
REVOKE SELECT ON public.artists FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='webmapdata_editor') THEN
  REVOKE SELECT ON public.artists FROM webmapdata_editor;
  IF has_any_column_privilege('webmapdata_editor','public.artists','SELECT') THEN
   RAISE EXCEPTION 'Retired reader retains raw artist access';
  END IF;
 END IF;
END $$;
${postflight}
RELEASE SAVEPOINT mn_about_access_cutover;
`;
}
