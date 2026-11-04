import manifest from "./webArtistColumns.json";

/** Explicit audited-role cutover, synthetic prototype only; does not discover or classify clients. */
export function buildFullArtistProjection(
  baseSql: string,
  roles: { reader: string | null; mapEditor: string; publicReaders: boolean },
): string {
  const identifier = (name: string) => {
    if (
      !/^[a-z_][a-z0-9_]*$/.test(name) ||
      name.length > 63 ||
      name.startsWith("pg_") ||
      [
        "public",
        "anon",
        "authenticated",
        "mnweb",
        "mn_projection_reader",
        "postgres",
        "service_role",
        "authenticator",
        "supabase_admin",
      ].includes(name)
    )
      throw new Error("Explicit independent audited role required");
    return `"${name}"`;
  };
  const reader = roles.reader === null ? null : identifier(roles.reader),
    editor = identifier(roles.mapEditor);
  if (reader === editor) throw new Error("Distinct audited roles required");
  const clients = [reader, editor].filter(Boolean).join(",");
  const expected = JSON.stringify(manifest.columns).replaceAll("'", "''");
  const shapeCheck = `IF (SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod)) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.artists'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM '${expected}'::jsonb THEN RAISE EXCEPTION 'Pinned artist column contract changed'; END IF;`;
  const original =
    "CREATE VIEW mn_public.artists WITH(security_barrier=true) AS\n SELECT a.id,a.name,mn_projection.public_bio(a.id) AS bio FROM public.artists a;";
  if (!baseSql.includes(original)) throw new Error("Projection template changed; review required");
  const columns = manifest.columns
    .map(c => (c.name === "bio" ? 'mn_projection.public_bio(a.id) AS "bio"' : `a."${c.name}"`))
    .join(",");
  const replacement = `CREATE FUNCTION mn_projection.artist_shape_current() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN ${shapeCheck} RETURN true; END $$;
ALTER FUNCTION mn_projection.artist_shape_current() OWNER TO mn_projection_reader;
REVOKE ALL ON FUNCTION mn_projection.artist_shape_current() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mn_projection.artist_shape_current() TO anon,authenticated,mnweb,${clients};
CREATE VIEW mn_public.artists WITH(security_barrier=true) AS SELECT ${columns} FROM public.artists a WHERE mn_projection.artist_shape_current();`;
  // Removing audited table SELECT is explicit; unknown-role grants are neither inferred nor changed.
  // Existing UPDATE(webmapdata) grant/RLS policy must already exist: this adds no update authority.
  return `BEGIN;
DO $$ BEGIN ${shapeCheck}
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN (${[roles.reader, roles.mapEditor]
   .filter(Boolean)
   .map(r => `'${r}'`)
   .join(
     ",",
   )}) AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Trusted role cannot be classified as a public reader'; END IF;
 ${
   roles.publicReaders
     ? ""
     : `IF EXISTS(SELECT 1 FROM pg_roles client WHERE client.rolname IN (${[
         roles.reader,
         roles.mapEditor,
       ]
         .filter(Boolean)
         .map(r => `'${r}'`)
         .join(
           ",",
         )}) AND (pg_has_role('anon',client.oid,'MEMBER') OR pg_has_role('authenticated',client.oid,'MEMBER'))) THEN RAISE EXCEPTION 'Denied public role can assume an approved reader'; END IF;`
 }
 END $$;
REVOKE SELECT ON public.artists FROM ${clients};
${baseSql.replace(original, () => replacement)}
GRANT USAGE ON SCHEMA mn_public TO ${clients};
GRANT SELECT ON mn_public.artists TO ${clients};
GRANT EXECUTE ON FUNCTION mn_projection.public_bio(uuid) TO ${clients};
GRANT SELECT(id,name,webmapdata) ON public.artists TO ${editor};
${roles.publicReaders ? "" : "REVOKE ALL ON mn_public.artists FROM anon,authenticated;REVOKE USAGE ON SCHEMA mn_public FROM anon,authenticated;REVOKE EXECUTE ON FUNCTION mn_projection.public_bio(uuid),mn_projection.artist_shape_current() FROM anon,authenticated;"}
DO $$ BEGIN
 IF has_column_privilege('${roles.mapEditor}','public.artists','bio','SELECT')
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.artists'::regclass AND attnum>0 AND NOT attisdropped AND attname<>'webmapdata' AND has_column_privilege('${roles.mapEditor}','public.artists',attname,'UPDATE'))
 THEN RAISE EXCEPTION 'Map role has broader privileges than the audited column contract'; END IF;
 END $$;
COMMIT;`;
}
