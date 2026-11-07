/** Explicit reuse of migration0062 receipts: validate the private contract before adding projection-only reads. */
export function useExistingUrlReceipts(baseSql: string): string {
  const start = baseSql.indexOf("CREATE TABLE mn_private.public_url_receipts (");
  const end = baseSql.indexOf("CREATE FUNCTION mn_projection.safe_url", start);
  if (start < 0 || end < 0) throw new Error("Receipt projection template changed; review required");
  const validation = `DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='mn_private.public_url_receipts'::regclass AND relkind='r' AND relrowsecurity)
 OR (SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) FROM pg_attribute WHERE attrelid='mn_private.public_url_receipts'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM '[["url_hash","bytea",true],["url","text",true],["policy_version","integer",true]]'::jsonb
 OR NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_collation c ON c.oid=a.attcollation WHERE a.attrelid='mn_private.public_url_receipts'::regclass AND a.attname='url' AND c.collname='C' AND c.collnamespace='pg_catalog'::regnamespace)
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='mn_private.public_url_receipts'::regclass AND contype='p' AND conkey=ARRAY[1,3]::smallint[])
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='mn_private.public_url_receipts'::regclass AND contype='c' AND convalidated AND regexp_replace(pg_get_expr(conbin,conrelid),'[()[:space:]]','','g')='octet_lengthurl_hash=32')
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='mn_private.public_url_receipts'::regclass AND contype='c' AND convalidated AND regexp_replace(pg_get_expr(conbin,conrelid),'[()[:space:]]','','g')='policy_version>0')
 THEN RAISE EXCEPTION 'Existing receipt schema does not match migration0062'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='mn_private.public_url_receipts'::regclass AND (a.grantee NOT IN(c.relowner,(SELECT oid FROM pg_roles WHERE rolname='mnweb')) OR (a.grantee=(SELECT oid FROM pg_roles WHERE rolname='mnweb') AND (a.privilege_type NOT IN('SELECT','INSERT') OR a.is_grantable))))
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='mn_private.public_url_receipts'::regclass AND attacl IS NOT NULL)
 OR NOT has_table_privilege('mnweb','mn_private.public_url_receipts','SELECT') OR NOT has_table_privilege('mnweb','mn_private.public_url_receipts','INSERT')
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='mn_private.public_url_receipts'::regclass)<>2
 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='mn_private.public_url_receipts'::regclass AND polcmd='r' AND polpermissive AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='mnweb')] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL)
 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='mn_private.public_url_receipts'::regclass AND polcmd='a' AND polpermissive AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='mnweb')] AND polqual IS NULL AND pg_get_expr(polwithcheck,polrelid)='true')
 THEN RAISE EXCEPTION 'Existing receipt access differs from migration0062'; END IF;
 END $$;
 GRANT SELECT ON mn_private.public_url_receipts TO mn_projection_reader;
 CREATE POLICY receipt_projection_read ON mn_private.public_url_receipts FOR SELECT TO mn_projection_reader USING(true);
`;
  return baseSql.slice(0, start) + validation + baseSql.slice(end);
}
