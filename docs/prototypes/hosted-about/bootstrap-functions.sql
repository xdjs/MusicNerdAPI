-- SQL-only functions/triggers and function ACLs copied verbatim from pinned migrations.

-- 0035_account_merge_attribution
CREATE FUNCTION public.transfer_account_activity(
    source_user uuid, target_user uuid, expected_privy_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    source_privy text;
    target_privy text;
    moved_count integer;
BEGIN
    IF source_user IS NULL OR target_user IS NULL OR source_user = target_user
       OR nullif(btrim(expected_privy_id), '') IS NULL THEN
        RAISE EXCEPTION 'Invalid account attribution transfer';
    END IF;

    -- Match mergeAccounts' lock order; FK inserts must wait for consolidation.
    PERFORM id FROM public.users WHERE id IN (source_user, target_user) ORDER BY id FOR UPDATE;
    SELECT privy_user_id INTO source_privy FROM public.users WHERE id = source_user;
    IF NOT FOUND OR source_privy IS NOT NULL THEN
        RAISE EXCEPTION 'Source account identity has not been released';
    END IF;
    SELECT privy_user_id INTO target_privy FROM public.users WHERE id = target_user;
    IF NOT FOUND OR target_privy IS DISTINCT FROM expected_privy_id THEN
        RAISE EXCEPTION 'Surviving account identity does not match';
    END IF;

    UPDATE public.artist_activity_events SET actor_user_id = target_user
    WHERE actor_user_id = source_user;
    GET DIAGNOSTICS moved_count = ROW_COUNT;

    INSERT INTO public.account_merge_events (source_user_id, target_user_id, activity_count)
    VALUES (source_user, target_user, moved_count);
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_account_activity(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_account_activity(uuid, uuid, text) TO mnweb;

-- 0039_source_versions
CREATE FUNCTION public.knowledge_vault_source_snapshot(r public.artist_vault_sources)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'version', 1, 'kind', 'vault', 'id', r.id, 'artistId', r.artist_id,
    'status', r.status, 'origin', r.origin, 'type', r.type, 'filePath', r.file_path,
    'url', r.url, 'title', r.title, 'snippet', r.snippet,
    'extractedText', r.extracted_text, 'publishedAt', r.published_at,
    'createdAt', to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'updatedAt', to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
$$;
CREATE FUNCTION public.knowledge_social_post_snapshot(r public.artist_social_posts)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'version', 1, 'kind', 'social', 'id', r.id, 'artistId', r.artist_id,
    'platform', r.platform, 'ownerUsername', r.owner_username, 'isOwnPost', r.is_own_post,
    'caption', r.caption, 'url', r.url,
    'postedAt', to_char(r.posted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'isRepost', r.raw->'isRepost', 'isRetweet', r.raw->'isRetweet',
    'transcript', jsonb_build_object(
      'version', r.raw->'_musicnerdTranscript'->'version',
      'actor', r.raw->'_musicnerdTranscript'->'actor',
      'text', r.raw->'_musicnerdTranscript'->'text',
      'fetchedAt', r.raw->'_musicnerdTranscript'->'fetchedAt'
    )
  );
$$;
CREATE FUNCTION public.knowledge_source_fingerprint(snapshot jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT encode(sha256(convert_to(
    ((snapshot - ARRAY['createdAt','updatedAt']) #- '{transcript,fetchedAt}')::text,
    'UTF8'
  )), 'hex');
$$;
CREATE FUNCTION public.retain_vault_source_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE previous_snapshot jsonb;
DECLARE previous_fingerprint text;
BEGIN
  IF OLD.status = 'approved' THEN
    previous_snapshot := public.knowledge_vault_source_snapshot(OLD);
    previous_fingerprint := public.knowledge_source_fingerprint(previous_snapshot);
    IF previous_fingerprint IS DISTINCT FROM public.knowledge_source_fingerprint(public.knowledge_vault_source_snapshot(NEW)) THEN
      INSERT INTO public.artist_vault_source_versions (source_id, artist_id, fingerprint, snapshot)
      VALUES (OLD.id, OLD.artist_id, previous_fingerprint, previous_snapshot)
      ON CONFLICT (source_id, fingerprint) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.retain_social_post_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE previous_snapshot jsonb;
DECLARE previous_fingerprint text;
BEGIN
  IF OLD.is_own_post AND OLD.raw->'isRepost' IS DISTINCT FROM 'true'::jsonb
      AND OLD.raw->'isRetweet' IS DISTINCT FROM 'true'::jsonb THEN
    previous_snapshot := public.knowledge_social_post_snapshot(OLD);
    previous_fingerprint := public.knowledge_source_fingerprint(previous_snapshot);
    IF previous_fingerprint IS DISTINCT FROM public.knowledge_source_fingerprint(public.knowledge_social_post_snapshot(NEW)) THEN
      INSERT INTO public.artist_social_post_versions (source_id, artist_id, fingerprint, snapshot)
      VALUES (OLD.id, OLD.artist_id, previous_fingerprint, previous_snapshot)
      ON CONFLICT (source_id, fingerprint) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.knowledge_vault_source_snapshot(public.artist_vault_sources),
  public.knowledge_social_post_snapshot(public.artist_social_posts), public.knowledge_source_fingerprint(jsonb),
  public.retain_vault_source_version(), public.retain_social_post_version()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.knowledge_vault_source_snapshot(public.artist_vault_sources),
  public.knowledge_social_post_snapshot(public.artist_social_posts), public.knowledge_source_fingerprint(jsonb),
  public.retain_vault_source_version(), public.retain_social_post_version() TO mnweb;
CREATE TRIGGER retain_vault_source_version AFTER UPDATE ON public.artist_vault_sources
  FOR EACH ROW EXECUTE FUNCTION public.retain_vault_source_version();
CREATE TRIGGER retain_social_post_version AFTER UPDATE ON public.artist_social_posts
  FOR EACH ROW EXECUTE FUNCTION public.retain_social_post_version();

-- 0056_catalog_disconnect
CREATE FUNCTION musicnerd_private.disconnect_catalog_link(
  p_artist_id uuid, p_platform text, p_expected_value text, p_expected_mapping jsonb,
  p_actor_user_id uuid, p_expected_claim_id uuid, p_authorization text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  current_value text;
  current_claim_id uuid;
  current_claim_user uuid;
  actor_admin boolean;
  actor_whitelisted boolean;
  mapping_row public.artist_id_mappings%ROWTYPE;
  mapping_json jsonb;
  affected integer;
BEGIN
  IF p_artist_id IS NULL OR p_actor_user_id IS NULL
     OR p_platform IS NULL OR p_platform NOT IN ('spotify', 'deezer')
     OR p_authorization IS NULL OR p_authorization NOT IN ('owner', 'contributor')
     OR (p_expected_value IS NOT NULL AND btrim(p_expected_value) = '') THEN
    RAISE EXCEPTION 'Invalid authenticated catalog disconnect' USING ERRCODE = 'P1581';
  END IF;

  -- Same order and keys as API/Web identity writers. A caller cannot omit locks.
  PERFORM pg_advisory_xact_lock(hashtextextended('musicnerd:artist-platform-slot:' || p_artist_id::text || ':' || p_platform, 0));
  IF p_expected_value IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('musicnerd:artist-platform:' || p_platform || ':' || p_expected_value, 0));
  END IF;
  SELECT CASE WHEN p_platform = 'deezer' THEN a.deezer ELSE a.spotify END
    INTO current_value FROM public.artists a WHERE a.id = p_artist_id FOR UPDATE;
  IF NOT FOUND OR current_value IS DISTINCT FROM p_expected_value THEN
    RAISE EXCEPTION 'Catalog identity changed; refresh before disconnecting' USING ERRCODE = 'P1580';
  END IF;

  -- Do not lock claim after artist: revocation locks/deletes claim before artist.
  SELECT c.id, c.user_id INTO current_claim_id, current_claim_user
    FROM public.artist_claims c WHERE c.artist_id = p_artist_id AND c.status = 'approved';
  IF current_claim_id IS DISTINCT FROM p_expected_claim_id THEN
    RAISE EXCEPTION 'Artist ownership changed' USING ERRCODE = 'P1581';
  END IF;
  SELECT u.is_admin, u.is_white_listed INTO actor_admin, actor_whitelisted
    FROM public.users u WHERE u.id = p_actor_user_id;
  IF NOT FOUND OR NOT (
    coalesce(actor_admin, false)
    OR (p_authorization = 'owner' AND current_claim_user = p_actor_user_id)
    OR (p_authorization = 'contributor' AND coalesce(actor_whitelisted, false))
  ) IS TRUE THEN
    RAISE EXCEPTION 'Not authorized for this catalog disconnect' USING ERRCODE = 'P1581';
  END IF;

  SELECT m.* INTO mapping_row FROM public.artist_id_mappings m
    WHERE m.artist_id = p_artist_id AND m.platform = p_platform FOR UPDATE;
  mapping_json := CASE WHEN FOUND THEN to_jsonb(mapping_row) ELSE NULL END;
  IF mapping_json IS DISTINCT FROM p_expected_mapping
     OR (mapping_json IS NOT NULL AND (current_value IS NULL OR mapping_row.platform_id IS DISTINCT FROM current_value)) THEN
    RAISE EXCEPTION 'Catalog mapping changed or differs from displayed identity; review required' USING ERRCODE = 'P1580';
  END IF;
  IF current_value IS NOT NULL THEN

  INSERT INTO musicnerd_private.catalog_link_disconnects
    (artist_id, platform, old_value, mapping_snapshot, actor_user_id, claim_id, authorization_mode)
    VALUES (p_artist_id, p_platform, current_value, mapping_json, p_actor_user_id, current_claim_id, p_authorization);

  IF mapping_json IS NOT NULL THEN
    DELETE FROM public.artist_id_mappings
      WHERE id = mapping_row.id AND artist_id = p_artist_id AND platform = p_platform
        AND platform_id = current_value;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'Catalog mapping changed during disconnect' USING ERRCODE = 'P1580';
    END IF;
  END IF;

  IF p_platform = 'deezer' THEN
    UPDATE public.artists SET deezer = NULL WHERE id = p_artist_id AND deezer = p_expected_value;
  ELSE
    UPDATE public.artists SET spotify = NULL WHERE id = p_artist_id AND spotify = p_expected_value;
  END IF;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Catalog identity changed during disconnect' USING ERRCODE = 'P1580';
  END IF;
  END IF;
  UPDATE public.artist_research_jobs
    SET status = 'done', claimed_at = NULL, updated_at = clock_timestamp(),
      state = state || '{"identityChanged":true,"outcome":"identity_changed"}'::jsonb
    WHERE artist_id = p_artist_id AND kind = 'spotify_match' AND status IN ('pending', 'running');
  RETURN current_value;
END;
$$;
REVOKE ALL ON FUNCTION musicnerd_private.disconnect_catalog_link(uuid,text,text,jsonb,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION musicnerd_private.disconnect_catalog_link(uuid,text,text,jsonb,uuid,uuid,text) TO mnweb;

-- 0058_catalog_automatic_reconnect_guard
CREATE FUNCTION musicnerd_private.catalog_link_was_disconnected(p_artist_id uuid, p_platform text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_artist_id IS NULL OR p_platform IS NULL OR p_platform NOT IN ('spotify', 'deezer') THEN
    RAISE EXCEPTION 'Invalid catalog identity scope' USING ERRCODE = '22023';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM musicnerd_private.catalog_link_disconnects
    WHERE artist_id = p_artist_id AND platform = p_platform
  );
END;
$$;
REVOKE ALL ON FUNCTION musicnerd_private.catalog_link_was_disconnected(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION musicnerd_private.catalog_link_was_disconnected(uuid,text) TO mnweb;

-- 0059_catalog_counterpart_jobs
CREATE FUNCTION musicnerd_private.queue_catalog_counterpart(p_artist_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a public.artists%ROWTYPE; anchor jsonb; target text;
BEGIN
 SELECT * INTO a FROM public.artists WHERE id=p_artist_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 anchor := jsonb_build_object('name',a.name,'spotify',a.spotify,'deezer',a.deezer);
 -- An identity edit invalidates an old lease, even if the new pair is complete.
 UPDATE public.artist_research_jobs SET status='done',claimed_at=NULL,updated_at=clock_timestamp(),
   state=state || '{"outcome":"identity_changed"}'::jsonb
 WHERE artist_id=a.id AND kind='catalog_match' AND status IN ('pending','running')
   AND state->'anchor' IS DISTINCT FROM anchor;
 IF nullif(a.spotify,'') IS NOT NULL AND nullif(a.deezer,'') IS NOT NULL THEN RETURN false; END IF;
 IF nullif(btrim(a.name),'') IS NULL OR length(a.name)>500
   OR (a.spotify IS NOT NULL AND a.spotify !~ '^[A-Za-z0-9]{22}$')
   OR (a.deezer IS NOT NULL AND a.deezer !~ '^[1-9][0-9]*$') THEN RETURN false; END IF;
 target := CASE WHEN a.spotify IS NULL THEN 'spotify' ELSE 'deezer' END;
 IF EXISTS(SELECT 1 FROM musicnerd_private.catalog_link_disconnects WHERE artist_id=a.id AND (platform=target OR (a.spotify IS NULL AND a.deezer IS NULL AND platform IN ('spotify','deezer')))) THEN
   UPDATE public.artist_research_jobs SET status='done',claimed_at=NULL,updated_at=clock_timestamp(),
     state=state || '{"outcome":"user_disconnected"}'::jsonb
   WHERE artist_id=a.id AND kind='catalog_match' AND status IN ('pending','running');
   RETURN false;
 END IF;
 -- Terminal ambiguous/no-match/failure results are evidence, not instructions to loop.
 IF EXISTS(SELECT 1 FROM public.artist_research_jobs WHERE artist_id=a.id AND kind='catalog_match' AND state->'anchor'=anchor AND state->>'outcome' IS DISTINCT FROM 'identity_changed') THEN RETURN false; END IF;
 INSERT INTO public.artist_research_jobs(artist_id,kind,status,state)
 VALUES(a.id,'catalog_match','pending',jsonb_build_object('version',1,'anchor',anchor,
   'expiresAtMs',floor(extract(epoch FROM (clock_timestamp()+interval '7 days'))*1000)))
 ON CONFLICT (artist_id,kind) WHERE status IN ('pending','running') DO NOTHING;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION musicnerd_private.queue_catalog_counterpart(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION musicnerd_private.queue_catalog_counterpart(uuid) TO mnweb;
CREATE FUNCTION musicnerd_private.queue_catalog_counterpart_after_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM musicnerd_private.queue_catalog_counterpart(NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION musicnerd_private.queue_catalog_counterpart_after_write() FROM PUBLIC,anon,authenticated,mnweb;
CREATE TRIGGER artists_catalog_counterpart AFTER INSERT OR UPDATE ON public.artists
 FOR EACH ROW EXECUTE FUNCTION musicnerd_private.queue_catalog_counterpart_after_write();
CREATE FUNCTION musicnerd_private.validate_catalog_identity_write()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.spotify IS DISTINCT FROM OLD.spotify THEN
   IF NEW.spotify IS NOT NULL AND NEW.spotify !~ '^[A-Za-z0-9]{22}$' THEN
     RAISE EXCEPTION 'Invalid Spotify artist ID' USING ERRCODE='23514';
   END IF;
 END IF;
 IF TG_OP='INSERT' OR NEW.deezer IS DISTINCT FROM OLD.deezer THEN
   IF NEW.deezer IS NOT NULL AND NEW.deezer !~ '^[1-9][0-9]*$' THEN
     RAISE EXCEPTION 'Invalid Deezer artist ID' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION musicnerd_private.validate_catalog_identity_write() FROM PUBLIC,anon,authenticated,mnweb;
CREATE TRIGGER artists_validate_catalog_identity BEFORE INSERT OR UPDATE OF spotify,deezer ON public.artists
 FOR EACH ROW EXECUTE FUNCTION musicnerd_private.validate_catalog_identity_write();
CREATE FUNCTION musicnerd_private.lock_catalog_exclusion_artist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   PERFORM id FROM public.artists WHERE id=OLD.artist_id FOR UPDATE;
   RETURN OLD;
 ELSIF TG_OP='UPDATE' THEN
   PERFORM id FROM public.artists WHERE id IN (OLD.artist_id,NEW.artist_id) ORDER BY id FOR UPDATE;
 ELSE
   PERFORM id FROM public.artists WHERE id=NEW.artist_id FOR UPDATE;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION musicnerd_private.lock_catalog_exclusion_artist() FROM PUBLIC,anon,authenticated,mnweb;
CREATE TRIGGER catalog_exclusion_artist_fence BEFORE INSERT OR UPDATE OR DELETE ON public.artist_mapping_exclusions
 FOR EACH ROW EXECUTE FUNCTION musicnerd_private.lock_catalog_exclusion_artist();

-- 0063_legacy_bio_publications
CREATE FUNCTION mn_private.consume_legacy_bio_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME = 'artists' THEN
  IF OLD.bio IS DISTINCT FROM NEW.bio THEN
   DELETE FROM mn_private.legacy_bio_publications WHERE artist_id=OLD.id;
  END IF;
 ELSIF TG_TABLE_NAME = 'artist_claims' THEN
  IF TG_OP = 'DELETE' THEN
   DELETE FROM mn_private.legacy_bio_publications WHERE claim_id=OLD.id;
  ELSIF OLD.status IS DISTINCT FROM NEW.status OR OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.artist_id IS DISTINCT FROM NEW.artist_id THEN
   DELETE FROM mn_private.legacy_bio_publications WHERE claim_id=OLD.id;
  END IF;
 ELSIF TG_TABLE_NAME = 'artist_bio_provenance' THEN
  IF TG_OP <> 'INSERT' THEN
   DELETE FROM mn_private.legacy_bio_publications WHERE artist_id=OLD.artist_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
   DELETE FROM mn_private.legacy_bio_publications WHERE artist_id=NEW.artist_id;
  END IF;
 ELSIF TG_TABLE_NAME = 'artist_vault_sources' THEN
  IF OLD.status='approved' AND OLD.publication <> 'private' THEN
   IF TG_OP='DELETE' THEN
    DELETE FROM mn_private.legacy_bio_publications WHERE artist_id=OLD.artist_id;
   ELSIF NEW.status <> 'approved' OR NEW.publication='private' OR OLD.artist_id IS DISTINCT FROM NEW.artist_id THEN
    DELETE FROM mn_private.legacy_bio_publications WHERE artist_id=OLD.artist_id;
   END IF;
  END IF;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION mn_private.consume_legacy_bio_publication() FROM PUBLIC, anon, authenticated, mnweb;
CREATE TRIGGER consume_legacy_bio_provenance AFTER INSERT OR UPDATE OR DELETE ON mn_private.artist_bio_provenance FOR EACH ROW EXECUTE FUNCTION mn_private.consume_legacy_bio_publication();
CREATE TRIGGER consume_legacy_bio_text AFTER UPDATE OF bio ON public.artists FOR EACH ROW EXECUTE FUNCTION mn_private.consume_legacy_bio_publication();
CREATE TRIGGER consume_legacy_bio_claim AFTER UPDATE OR DELETE ON public.artist_claims FOR EACH ROW EXECUTE FUNCTION mn_private.consume_legacy_bio_publication();
CREATE TRIGGER consume_legacy_bio_source AFTER UPDATE OR DELETE ON public.artist_vault_sources FOR EACH ROW EXECUTE FUNCTION mn_private.consume_legacy_bio_publication();
