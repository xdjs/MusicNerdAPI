/** Apply ONLY the proposed legacy/empty-generated visibility policy to the isolated SQL guard. */
export function buildEvidenceBackedSql(baseSql: string): string {
  if (baseSql.includes("FROM mn_private.legacy_bio_publications lp")) {
    return baseSql.replace(
      /IF NOT FOUND THEN RETURN CASE WHEN EXISTS\(SELECT 1 FROM mn_private\.legacy_bio_publications lp[\s\S]*?END IF;/,
      "IF NOT FOUND THEN RETURN NULL; END IF;",
    );
  }
  const legacy =
    "IF NOT FOUND THEN RETURN CASE WHEN claim_id IS NOT NULL THEN a.bio ELSE NULL END; END IF;";
  const empty =
    "IF p->>'claimId' IS NULL AND jsonb_array_length(p->'sources')=0 THEN RETURN NULL; END IF;";
  if (
    baseSql.includes("IF NOT FOUND THEN RETURN NULL; END IF;") &&
    baseSql.includes(
      "IF (p->>'claimId' IS NULL OR p->>'kind'='generated') AND jsonb_array_length(p->'sources')=0 THEN RETURN NULL; END IF;",
    )
  )
    return baseSql;
  if (baseSql.split(legacy).length !== 2 || baseSql.split(empty).length !== 2)
    throw new Error("SQL guard changed; candidate policy needs review");
  return baseSql
    .replace(legacy, "IF NOT FOUND THEN RETURN NULL; END IF;")
    .replace(
      empty,
      "IF (p->>'claimId' IS NULL OR p->>'kind'='generated') AND jsonb_array_length(p->'sources')=0 THEN RETURN NULL; END IF;",
    );
}
