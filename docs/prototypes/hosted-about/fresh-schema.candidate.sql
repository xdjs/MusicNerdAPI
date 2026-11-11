-- NON-EXECUTABLE REVIEW CANDIDATE: known failures in missing private schema and UUID index operator class.
-- Generated from Web d219118f1e3b9a0fa5c3807a8bf3ea4414fad99f declared Drizzle schema.
-- Not a complete bootstrap: external roles/extensions, SQL functions/triggers/grants and history reconciliation remain required.
CREATE SCHEMA "mn_private";

--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('high', 'medium', 'low', 'manual');
--> statement-breakpoint
CREATE TYPE "public"."exclusion_reason" AS ENUM('conflict', 'name_mismatch', 'too_ambiguous');
--> statement-breakpoint
CREATE TYPE "public"."platform_type" AS ENUM('social', 'web3', 'listen');
--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TABLE "account_merge_events" (
	"source_user_id" uuid PRIMARY KEY NOT NULL,
	"target_user_id" uuid NOT NULL,
	"activity_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_merge_distinct_users" CHECK ("account_merge_events"."source_user_id" <> "account_merge_events"."target_user_id"),
	CONSTRAINT "account_merge_nonnegative_count" CHECK ("account_merge_events"."activity_count" >= 0)
);

--> statement-breakpoint
ALTER TABLE "account_merge_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "agent_heartbeats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"status" text DEFAULT 'starting' NOT NULL,
	"current_run" integer,
	"batch_platform" text,
	"batch_size" integer,
	"message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"config" jsonb,
	CONSTRAINT "agent_heartbeats_worker_id_unique" UNIQUE("worker_id")
);

--> statement-breakpoint
ALTER TABLE "agent_heartbeats" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"run_number" integer NOT NULL,
	"platform" text DEFAULT 'deezer' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"wall_time_secs" integer,
	"claude_time_secs" integer,
	"api_time_secs" integer,
	"turns" integer,
	"batch_size" integer,
	"resolved" integer DEFAULT 0,
	"excluded" integer DEFAULT 0,
	"skipped" integer DEFAULT 0,
	"errors" integer DEFAULT 0,
	"high_confidence" integer DEFAULT 0,
	"medium_confidence" integer DEFAULT 0,
	"conflicts" integer DEFAULT 0,
	"name_mismatches" integer DEFAULT 0,
	"too_ambiguous" integer DEFAULT 0,
	"exit_code" integer,
	"fail_category" text,
	"fail_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "agent_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "aiprompts" (
	"prompt_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp,
	"prompt_before_name" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"prompt_after_name" text
);

--> statement-breakpoint
ALTER TABLE "aiprompts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_activity_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_kind" text NOT NULL,
	"action" text NOT NULL,
	"trigger" text NOT NULL,
	"source_id" uuid,
	"parent_activity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_activity_actor_kind" CHECK ("artist_activity_events"."actor_kind" in ('user', 'system', 'unknown'))
);

--> statement-breakpoint
ALTER TABLE "artist_activity_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_bio_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text NOT NULL,
	"source_url" text,
	"bio_snapshot" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	CONSTRAINT "artist_bio_corrections_reason" CHECK ("artist_bio_corrections"."reason" in ('wrong_artist','incorrect','outdated','other')),
	CONSTRAINT "artist_bio_corrections_status" CHECK ("artist_bio_corrections"."status" in ('pending','resolved','dismissed')),
	CONSTRAINT "artist_bio_corrections_bounds" CHECK (length("artist_bio_corrections"."details") <= 2000 and length("artist_bio_corrections"."bio_snapshot") between 1 and 12000 and ("artist_bio_corrections"."source_url" is null or length("artist_bio_corrections"."source_url") <= 2048)),
	CONSTRAINT "artist_bio_corrections_review" CHECK (("artist_bio_corrections"."status" = 'pending' and "artist_bio_corrections"."reviewed_at" is null and "artist_bio_corrections"."reviewed_by" is null) or ("artist_bio_corrections"."status" <> 'pending' and "artist_bio_corrections"."reviewed_at" is not null and "artist_bio_corrections"."reviewed_by" is not null))
);

--> statement-breakpoint
ALTER TABLE "artist_bio_corrections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "mn_private"."artist_bio_provenance" (
	"artist_id" uuid PRIMARY KEY NOT NULL,
	"provenance" jsonb NOT NULL,
	CONSTRAINT "artist_bio_provenance_object" CHECK (jsonb_typeof("mn_private"."artist_bio_provenance"."provenance")='object')
);

--> statement-breakpoint
ALTER TABLE "mn_private"."artist_bio_provenance" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "mn_private"."artist_bio_version_provenance" (
	"version_id" uuid PRIMARY KEY NOT NULL,
	"provenance" jsonb NOT NULL,
	CONSTRAINT "artist_bio_version_provenance_object" CHECK (jsonb_typeof("mn_private"."artist_bio_version_provenance"."provenance")='object')
);

--> statement-breakpoint
ALTER TABLE "mn_private"."artist_bio_version_provenance" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_bio_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"bio_text" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL
);

--> statement-breakpoint
ALTER TABLE "artist_bio_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_claims" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"reference_code" text,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL
);

--> statement-breakpoint
ALTER TABLE "artist_claims" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_directory_preparations" (
	"artist_id" uuid PRIMARY KEY NOT NULL,
	"activity_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" text NOT NULL,
	"document" text,
	"about" text,
	"starting_bio" text,
	"public_about" jsonb,
	"manifest" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_directory_preparations_status" CHECK ("artist_directory_preparations"."status" in ('ready','insufficient')),
	CONSTRAINT "artist_directory_preparations_ready" CHECK ("artist_directory_preparations"."status" <> 'ready' or ("artist_directory_preparations"."document" is not null and "artist_directory_preparations"."about" is not null))
);

--> statement-breakpoint
ALTER TABLE "artist_directory_preparations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_doc_corrections" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"claim" text NOT NULL,
	"correction" text,
	"kind" text DEFAULT 'wrong' NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL
);

--> statement-breakpoint
ALTER TABLE "artist_doc_corrections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_docs" (
	"lore_summary" jsonb,
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "artist_docs_artist_id_key" UNIQUE("artist_id")
);

--> statement-breakpoint
ALTER TABLE "artist_docs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_id_mappings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"platform_id" text NOT NULL,
	"confidence" "confidence_level" NOT NULL,
	"source" text NOT NULL,
	"reasoning" text,
	"api_key_hash" text,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_id_mappings_artist_platform_uniq" UNIQUE("artist_id","platform"),
	CONSTRAINT "artist_id_mappings_platform_id_uniq" UNIQUE("platform","platform_id")
);

--> statement-breakpoint
ALTER TABLE "artist_id_mappings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_interview_answer_versions" (
	"answer_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"revision" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"note" text,
	"actor_user_id" uuid,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_interview_answer_versions_answer_revision" PRIMARY KEY("answer_id","revision"),
	CONSTRAINT "artist_interview_answer_versions_revision" CHECK ("artist_interview_answer_versions"."revision" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "artist_interview_answer_versions_identity" CHECK (coalesce("artist_interview_answer_versions"."snapshot"->>'id' = "artist_interview_answer_versions"."answer_id"::text AND "artist_interview_answer_versions"."snapshot"->>'artistId' = "artist_interview_answer_versions"."artist_id"::text AND jsonb_typeof("artist_interview_answer_versions"."snapshot"->'answer') = 'string', false)),
	CONSTRAINT "artist_interview_answer_versions_note" CHECK ("artist_interview_answer_versions"."note" IS NULL OR char_length("artist_interview_answer_versions"."note") <= 400)
);

--> statement-breakpoint
ALTER TABLE "artist_interview_answer_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_interview_answers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"source" text NOT NULL,
	"sitting" integer,
	"offered_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "artist_interview_answers_artist_question_uniq" UNIQUE("artist_id","question_key")
);

--> statement-breakpoint
ALTER TABLE "artist_interview_answers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_interview_boundaries" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"wording" text NOT NULL,
	"scope" text NOT NULL,
	"sitting" integer NOT NULL,
	"origin_answer_id" uuid,
	"origin_question_key" text NOT NULL,
	"origin_question" text NOT NULL,
	"created_by" uuid,
	"activity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retracted_at" timestamp with time zone,
	"retracted_by" uuid,
	"retraction_activity_id" uuid,
	CONSTRAINT "artist_interview_boundaries_request" UNIQUE("artist_id","request_id"),
	CONSTRAINT "artist_interview_boundaries_scope" CHECK ("artist_interview_boundaries"."scope" in ('sitting','until_retracted') AND "artist_interview_boundaries"."sitting" > 0),
	CONSTRAINT "artist_interview_boundaries_wording" CHECK (char_length(btrim("artist_interview_boundaries"."wording")) > 0 AND char_length("artist_interview_boundaries"."wording") <= 4000 AND char_length("artist_interview_boundaries"."origin_question_key") between 1 and 500 AND char_length("artist_interview_boundaries"."origin_question") between 1 and 8000)
);

--> statement-breakpoint
ALTER TABLE "artist_interview_boundaries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_interview_question_evidence" (
	"answer_id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"memory_snapshot_id" text NOT NULL,
	"evidence_references" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_interview_evidence_ordinal" UNIQUE("session_id","ordinal"),
	CONSTRAINT "artist_interview_evidence_valid" CHECK ("artist_interview_question_evidence"."ordinal" between 1 and 3 AND "artist_interview_question_evidence"."memory_snapshot_id" ~ '^[a-f0-9]{64}$' AND jsonb_typeof("artist_interview_question_evidence"."evidence_references") = 'array' AND jsonb_array_length("artist_interview_question_evidence"."evidence_references") between 1 and 3 AND char_length("artist_interview_question_evidence"."evidence_references"::text) <= 16000)
);

--> statement-breakpoint
ALTER TABLE "artist_interview_question_evidence" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"sitting" integer NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "artist_interview_sessions_request" UNIQUE("artist_id","request_id"),
	CONSTRAINT "artist_interview_sessions_sitting" UNIQUE("artist_id","sitting"),
	CONSTRAINT "artist_interview_sessions_identity" UNIQUE("id","artist_id"),
	CONSTRAINT "artist_interview_sessions_state" CHECK ("artist_interview_sessions"."sitting" > 0 AND (("artist_interview_sessions"."state" = 'active' AND "artist_interview_sessions"."closed_at" IS NULL) OR ("artist_interview_sessions"."state" = 'finished' AND "artist_interview_sessions"."closed_at" IS NOT NULL)))
);

--> statement-breakpoint
ALTER TABLE "artist_interview_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_latest_provider_snapshots" (
	"artist_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"account_id" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "artist_latest_provider_snapshots_artist_id_provider_pk" PRIMARY KEY("artist_id","provider"),
	CONSTRAINT "artist_latest_provider_snapshots_provider" CHECK ("artist_latest_provider_snapshots"."provider" in ('spotify','deezer','inprocess')),
	CONSTRAINT "artist_latest_provider_snapshots_account" CHECK (length("artist_latest_provider_snapshots"."account_id") between 1 and 2048),
	CONSTRAINT "artist_latest_provider_snapshots_status" CHECK ("artist_latest_provider_snapshots"."status" in ('checked','failed')),
	CONSTRAINT "artist_latest_provider_snapshots_items" CHECK (jsonb_typeof("artist_latest_provider_snapshots"."items") = 'array' and jsonb_array_length("artist_latest_provider_snapshots"."items") <= 50 and octet_length("artist_latest_provider_snapshots"."items"::text) <= 400000)
);

--> statement-breakpoint
ALTER TABLE "artist_latest_provider_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_mapping_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"reason" "exclusion_reason" NOT NULL,
	"details" text,
	"api_key_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_mapping_exclusions_artist_platform_uniq" UNIQUE("artist_id","platform")
);

--> statement-breakpoint
ALTER TABLE "artist_mapping_exclusions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_onboarding_interview_plans" (
	"artist_id" uuid PRIMARY KEY NOT NULL,
	"claim_id" uuid,
	"questions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_onboarding_interview_plans_questions" CHECK (jsonb_typeof("artist_onboarding_interview_plans"."questions") = 'array' and jsonb_array_length("artist_onboarding_interview_plans"."questions") between 1 and 3)
);

--> statement-breakpoint
ALTER TABLE "artist_onboarding_interview_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_onboarding_steps" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"step" text NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "artist_onboarding_steps_artist_step_uniq" UNIQUE("artist_id","step")
);

--> statement-breakpoint
ALTER TABLE "artist_onboarding_steps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_question_answers" (
	"job_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"question_hash" text NOT NULL,
	"status" text NOT NULL,
	"claim_token" uuid NOT NULL,
	"claim_until" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"result" jsonb,
	"failure_stage" text,
	"failure_diagnostics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_question_answers_job_id_question_hash_pk" PRIMARY KEY("job_id","question_hash"),
	CONSTRAINT "artist_question_answers_hash" CHECK ("artist_question_answers"."question_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "artist_question_answers_status" CHECK ("artist_question_answers"."status" in ('waiting','drafting','verified','failed')),
	CONSTRAINT "artist_question_answers_attempts" CHECK ("artist_question_answers"."attempts" between 0 and 3),
	CONSTRAINT "artist_question_answers_diagnostics" CHECK (case when jsonb_typeof("artist_question_answers"."failure_diagnostics") = 'array' then jsonb_array_length("artist_question_answers"."failure_diagnostics") <= 3 and octet_length("artist_question_answers"."failure_diagnostics"::text) <= 2048 else false end),
	CONSTRAINT "artist_question_answers_result" CHECK (("artist_question_answers"."status" = 'verified' and jsonb_typeof("artist_question_answers"."result") = 'object') or ("artist_question_answers"."status" <> 'verified' and "artist_question_answers"."result" is null))
);

--> statement-breakpoint
ALTER TABLE "artist_question_answers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_question_requests" (
	"artist_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"token" uuid NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"job_id" uuid,
	"question_hash" text,
	"reusable" boolean DEFAULT false NOT NULL,
	"answer_intent" text,
	"routing" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "artist_question_requests_artist_id_request_hash_pk" PRIMARY KEY("artist_id","request_hash"),
	CONSTRAINT "artist_question_requests_hash" CHECK ("artist_question_requests"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "artist_question_requests_binding" CHECK (("artist_question_requests"."job_id" is null and "artist_question_requests"."question_hash" is null and not "artist_question_requests"."reusable") or ("artist_question_requests"."job_id" is not null and "artist_question_requests"."question_hash" is not null and "artist_question_requests"."question_hash" ~ '^[a-f0-9]{64}$')),
	CONSTRAINT "artist_question_requests_intent" CHECK ("artist_question_requests"."answer_intent" is null or length("artist_question_requests"."answer_intent") between 1 and 500),
	CONSTRAINT "artist_question_requests_routing" CHECK (jsonb_typeof("artist_question_requests"."routing") = 'object' and octet_length("artist_question_requests"."routing"::text)<=16000)
);

--> statement-breakpoint
ALTER TABLE "artist_question_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_research_candidates" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"url" text NOT NULL,
	"destination" text NOT NULL,
	"platform" text,
	"platform_id" text,
	"reason" text NOT NULL,
	"identity" text DEFAULT 'unresolved' NOT NULL,
	"curation" text DEFAULT 'pending' NOT NULL,
	"source_id" uuid,
	"reviewed_by" uuid,
	"review_activity_id" uuid,
	"reviewed_revision" text,
	"current_revision" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_research_candidates_artist_url" UNIQUE("artist_id","url"),
	CONSTRAINT "artist_research_candidates_artist_id" UNIQUE("artist_id","id"),
	CONSTRAINT "artist_research_candidates_url" CHECK (char_length("artist_research_candidates"."url") between 1 and 2048 AND "artist_research_candidates"."url" ~ '^https?://'),
	CONSTRAINT "artist_research_candidates_destination" CHECK ("artist_research_candidates"."destination" = 'lore' OR ("artist_research_candidates"."destination" = 'link' AND "artist_research_candidates"."platform" IS NOT NULL AND "artist_research_candidates"."platform_id" IS NOT NULL)),
	CONSTRAINT "artist_research_candidates_reason" CHECK ("artist_research_candidates"."reason" IN ('reporting','release_date','credits','social_caption','spoken_content')),
	CONSTRAINT "artist_research_candidates_identity" CHECK ("artist_research_candidates"."identity" IN ('confirmed','unresolved','wrong_artist')),
	CONSTRAINT "artist_research_candidates_curation" CHECK ("artist_research_candidates"."curation" IN ('pending','approved','declined','wrong_artist','incorrect'))
);

--> statement-breakpoint
ALTER TABLE "artist_research_candidates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_research_evidence" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"revision" text NOT NULL,
	"title" text,
	"original_text" text NOT NULL,
	"provenance" jsonb NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_research_evidence_candidate_revision" UNIQUE("candidate_id","revision"),
	CONSTRAINT "artist_research_evidence_revision" CHECK ("artist_research_evidence"."revision" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "artist_research_evidence_text" CHECK (char_length(btrim("artist_research_evidence"."original_text")) > 0 AND char_length("artist_research_evidence"."original_text") <= 50000 AND char_length(coalesce("artist_research_evidence"."title",'')) <= 500),
	CONSTRAINT "artist_research_evidence_provenance" CHECK (jsonb_typeof("artist_research_evidence"."provenance") = 'object' AND octet_length("artist_research_evidence"."provenance"::text) <= 16384 AND coalesce("artist_research_evidence"."provenance"->>'kind' IN ('original_text','caption','provider_transcript'), false))
);

--> statement-breakpoint
ALTER TABLE "artist_research_evidence" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_research_jobs" (
	"activity_id" uuid,
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"total" integer,
	"claimed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "artist_research_jobs_kind_check" CHECK ("artist_research_jobs"."kind" in ('social_ingest', 'caption_extract', 'lore_refresh', 'source_search', 'latest_refresh', 'source_extract', 'question_research', 'spotify_match', 'interview_prepare', 'catalog_match')),
	CONSTRAINT "artist_research_jobs_status_check" CHECK ("artist_research_jobs"."status" in ('pending','running','done','failed') or ("artist_research_jobs"."status" = 'queued' and "artist_research_jobs"."kind" = 'source_extract' and coalesce("artist_research_jobs"."state"->>'version','') = '2' and coalesce("artist_research_jobs"."state"->>'autoSourceId','') <> ''))
);

--> statement-breakpoint
ALTER TABLE "artist_research_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_self_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"site_name" text NOT NULL,
	"old_value" text,
	"new_value" text NOT NULL,
	"submitted_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "artist_self_edits_changed" CHECK ("artist_self_edits"."old_value" IS DISTINCT FROM "artist_self_edits"."new_value"),
	CONSTRAINT "artist_self_edits_nonempty" CHECK (length("artist_self_edits"."new_value") > 0)
);

--> statement-breakpoint
ALTER TABLE "artist_self_edits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_social_credits" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"kind" text NOT NULL,
	"subject" text,
	"is_handle" boolean DEFAULT false NOT NULL,
	"is_self" boolean DEFAULT false NOT NULL,
	"label" text NOT NULL,
	"quote" text NOT NULL,
	"source_url" text NOT NULL,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL
);

--> statement-breakpoint
ALTER TABLE "artist_social_credits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_social_post_versions" (
	"source_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_social_post_versions_source_id_fingerprint_pk" PRIMARY KEY("source_id","fingerprint"),
	CONSTRAINT "artist_social_post_versions_fingerprint" CHECK ("artist_social_post_versions"."fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "artist_social_post_versions_identity" CHECK (coalesce("artist_social_post_versions"."snapshot"->>'id' = "artist_social_post_versions"."source_id"::text
        AND "artist_social_post_versions"."snapshot"->>'artistId' = "artist_social_post_versions"."artist_id"::text
        AND "artist_social_post_versions"."snapshot"->>'kind' = 'social' AND "artist_social_post_versions"."snapshot"->>'version' = '1', false))
);

--> statement-breakpoint
ALTER TABLE "artist_social_post_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_social_posts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"platform_post_id" text NOT NULL,
	"owner_username" text NOT NULL,
	"is_own_post" boolean NOT NULL,
	"caption" text,
	"url" text NOT NULL,
	"posted_at" timestamp with time zone,
	"like_count" integer,
	"comment_count" integer,
	"play_count" integer,
	"hashtags" text[] DEFAULT '{}' NOT NULL,
	"mentions" text[] DEFAULT '{}' NOT NULL,
	"coauthors" text[] DEFAULT '{}' NOT NULL,
	"music_title" text,
	"music_artist" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "artist_social_posts_artist_platform_post_uniq" UNIQUE("artist_id","platform","platform_post_id")
);

--> statement-breakpoint
ALTER TABLE "artist_social_posts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_social_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"handle" text NOT NULL,
	"followers_count" integer,
	"bio" text,
	"avatar_url" text,
	"scraped_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "artist_social_profiles_artist_platform_uniq" UNIQUE("artist_id","platform")
);

--> statement-breakpoint
ALTER TABLE "artist_social_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_social_refreshes" (
	"artist_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"account_handle" text NOT NULL,
	"scope" text DEFAULT 'profile' NOT NULL,
	"covered_through" timestamp with time zone,
	"checked_at" timestamp with time zone NOT NULL,
	"scan_started_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"item_count" integer NOT NULL,
	"run_id" text NOT NULL,
	"scan_reference" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "artist_social_refreshes_artist_id_platform_account_handle_scope_pk" PRIMARY KEY("artist_id","platform","account_handle","scope"),
	CONSTRAINT "artist_social_refreshes_platform" CHECK ("artist_social_refreshes"."platform" in ('instagram','tiktok','x')),
	CONSTRAINT "artist_social_refreshes_handle" CHECK ("artist_social_refreshes"."account_handle" ~ '^[a-z0-9_.]{1,64}$'),
	CONSTRAINT "artist_social_refreshes_status" CHECK ("artist_social_refreshes"."status" in ('complete','limited')),
	CONSTRAINT "artist_social_refreshes_complete" CHECK ("artist_social_refreshes"."status" <> 'complete' or "artist_social_refreshes"."covered_through" is not null),
	CONSTRAINT "artist_social_refreshes_scope" CHECK ("artist_social_refreshes"."scope" in ('latest','profile') and ("artist_social_refreshes"."scope" <> 'latest' or "artist_social_refreshes"."platform" = 'instagram')),
	CONSTRAINT "artist_social_refreshes_reference" CHECK (jsonb_typeof("artist_social_refreshes"."scan_reference") = 'object'),
	CONSTRAINT "artist_social_refreshes_count" CHECK ("artist_social_refreshes"."item_count" >= 0),
	CONSTRAINT "artist_social_refreshes_run" CHECK (length(btrim("artist_social_refreshes"."run_id")) > 0),
	CONSTRAINT "artist_social_refreshes_dates" CHECK ("artist_social_refreshes"."checked_at" >= "artist_social_refreshes"."scan_started_at" and ("artist_social_refreshes"."covered_through" is null or "artist_social_refreshes"."covered_through" <= "artist_social_refreshes"."scan_started_at"))
);

--> statement-breakpoint
ALTER TABLE "artist_social_refreshes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_source_assessments" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "artist_source_assessments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_vault_source_versions" (
	"source_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_vault_source_versions_source_id_fingerprint_pk" PRIMARY KEY("source_id","fingerprint"),
	CONSTRAINT "artist_vault_source_versions_fingerprint" CHECK ("artist_vault_source_versions"."fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "artist_vault_source_versions_identity" CHECK (coalesce("artist_vault_source_versions"."snapshot"->>'id' = "artist_vault_source_versions"."source_id"::text
        AND "artist_vault_source_versions"."snapshot"->>'artistId' = "artist_vault_source_versions"."artist_id"::text
        AND "artist_vault_source_versions"."snapshot"->>'kind' = 'vault' AND "artist_vault_source_versions"."snapshot"->>'version' = '1', false))
);

--> statement-breakpoint
ALTER TABLE "artist_vault_source_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artist_vault_sources" (
	"publication" text DEFAULT 'inherit' NOT NULL,
	"origin" text DEFAULT 'unknown' NOT NULL,
	"activity_id" uuid,
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"snippet" text,
	"type" text,
	"status" "source_status" DEFAULT 'pending' NOT NULL,
	"file_name" text,
	"file_size" integer,
	"file_path" text,
	"content_type" text,
	"extracted_text" text,
	"og_image" text,
	"podcast_episode_key" text,
	"podcast_show_title" text,
	"podcast_episode_title" text,
	"published_at" date,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "artist_vault_sources_publication_check" CHECK ("artist_vault_sources"."publication" in ('inherit', 'public', 'private'))
);

--> statement-breakpoint
ALTER TABLE "artist_vault_sources" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"legacy_id" text,
	"bandcamp" text,
	"facebook" text,
	"x" text,
	"soundcloud" text,
	"notes" text,
	"patreon" text,
	"name" text,
	"instagram" text,
	"youtube" text,
	"youtubechannel" text,
	"lcname" text,
	"soundcloudID" integer,
	"spotify" text,
	"twitch" text,
	"imdb" text,
	"musicbrainz" text,
	"wikidata" text,
	"mixcloud" text,
	"facebookID" text,
	"discogs" text,
	"tiktok" text,
	"tiktokID" text,
	"jaxsta" text,
	"famousbirthdays" text,
	"songexploder" text,
	"colorsxstudios" text,
	"bandsintown" text,
	"linktree" text,
	"onlyfans" text,
	"wikipedia" text,
	"audius" text,
	"zora" text,
	"catalog" text,
	"opensea" text,
	"foundation" text,
	"lastfm" text,
	"linkedin" text,
	"soundxyz" text,
	"mirror" text,
	"glassnode" text,
	"collectsNFTs" boolean,
	"spotifyusername" text,
	"bandcampfan" text,
	"tellie" text,
	"wallets" text[],
	"ens" text,
	"lens" text,
	"added_by" uuid,
	"cameo" text,
	"farcaster" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"supercollector" text,
	"bio" text,
	"custom_image" text,
	"header_image_position" jsonb,
	"link_order" jsonb,
	"webmapdata" jsonb,
	"node_pfp" jsonb,
	"deezer" text,
	"subvert" text,
	"bluesky" text,
	"inprocess" text
);

--> statement-breakpoint
ALTER TABLE "artists" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "bot_prompts" (
	"slow" jsonb NOT NULL,
	"moderate" jsonb,
	"busy" jsonb,
	"prompts" text NOT NULL,
	"fun_fact" text,
	"shaming" jsonb,
	"track_fact" text,
	"emoji" jsonb
);

--> statement-breakpoint
ALTER TABLE "bot_prompts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "musicnerd_private"."catalog_link_disconnects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"old_value" text NOT NULL,
	"mapping_snapshot" jsonb,
	"actor_user_id" uuid NOT NULL,
	"claim_id" uuid,
	"authorization_mode" text NOT NULL,
	"disconnected_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "catalog_link_disconnects_platform_check" CHECK ("musicnerd_private"."catalog_link_disconnects"."platform" IN ('spotify', 'deezer')),
	CONSTRAINT "catalog_link_disconnects_old_value_check" CHECK (length(btrim("musicnerd_private"."catalog_link_disconnects"."old_value")) > 0),
	CONSTRAINT "catalog_link_disconnects_authorization_mode_check" CHECK ("musicnerd_private"."catalog_link_disconnects"."authorization_mode" IN ('owner', 'contributor')),
	CONSTRAINT "catalog_disconnect_mapping_snapshot" CHECK ("musicnerd_private"."catalog_link_disconnects"."mapping_snapshot" IS NULL OR (jsonb_typeof("musicnerd_private"."catalog_link_disconnects"."mapping_snapshot") = 'object' AND "musicnerd_private"."catalog_link_disconnects"."mapping_snapshot"->>'artist_id' = "musicnerd_private"."catalog_link_disconnects"."artist_id"::text AND "musicnerd_private"."catalog_link_disconnects"."mapping_snapshot"->>'platform' = "musicnerd_private"."catalog_link_disconnects"."platform" AND "musicnerd_private"."catalog_link_disconnects"."mapping_snapshot"->>'platform_id' = "musicnerd_private"."catalog_link_disconnects"."old_value" AND "musicnerd_private"."catalog_link_disconnects"."mapping_snapshot"->>'id' IS NOT NULL))
);

--> statement-breakpoint
ALTER TABLE "musicnerd_private"."catalog_link_disconnects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "featured" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"featured_artist" uuid,
	"featured_collector" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);

--> statement-breakpoint
ALTER TABLE "featured" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "history" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"top_artist" text,
	"top_track" text,
	"track_id" text
);

--> statement-breakpoint
ALTER TABLE "history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "mn_private"."legacy_bio_publications" (
	"artist_id" uuid PRIMARY KEY NOT NULL,
	"claim_id" uuid NOT NULL,
	"bio_hash" text NOT NULL,
	CONSTRAINT "legacy_bio_publications_hash" CHECK ("mn_private"."legacy_bio_publications"."bio_hash" ~ '^[a-f0-9]{64}$')
);

--> statement-breakpoint
ALTER TABLE "mn_private"."legacy_bio_publications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "mcp_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"key_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "mcp_api_keys_key_hash_unique" UNIQUE("key_hash")
);

--> statement-breakpoint
ALTER TABLE "mcp_api_keys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "mcp_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"artist_id" uuid NOT NULL,
	"field" text NOT NULL,
	"action" text NOT NULL,
	"submitted_url" text,
	"old_value" text,
	"new_value" text,
	"api_key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "mcp_audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "provider_request_cooldowns" (
	"provider_key" text PRIMARY KEY NOT NULL,
	"blocked_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "provider_request_cooldowns" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "mn_private"."public_url_receipts" (
	"url_hash" "bytea" NOT NULL,
	"url" text COLLATE "C" NOT NULL,
	"policy_version" integer NOT NULL,
	CONSTRAINT "public_url_receipts_pkey" PRIMARY KEY("url_hash","policy_version"),
	CONSTRAINT "public_url_receipts_hash_length" CHECK (octet_length("mn_private"."public_url_receipts"."url_hash")=32),
	CONSTRAINT "public_url_receipts_policy_positive" CHECK ("mn_private"."public_url_receipts"."policy_version" > 0)
);

--> statement-breakpoint
ALTER TABLE "mn_private"."public_url_receipts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "question_planning_admissions" (
	"visitor_key" text NOT NULL,
	"admitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_planning_admissions_key" CHECK ("question_planning_admissions"."visitor_key" ~ '^[a-f0-9]{64}$')
);

--> statement-breakpoint
ALTER TABLE "question_planning_admissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "ugcresearch" (
	"origin" text DEFAULT 'unknown' NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"artist_uri" text,
	"accepted" boolean DEFAULT false,
	"ugc_url" text,
	"site_name" text,
	"site_username" text,
	"artist_id" uuid,
	"date_processed" timestamp,
	"name" text,
	"user_id" uuid
);

--> statement-breakpoint
ALTER TABLE "ugcresearch" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "urlmap" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"site_url" text NOT NULL,
	"site_name" text NOT NULL,
	"example" text NOT NULL,
	"app_string_format" text NOT NULL,
	"order" integer,
	"is_iframe_enabled" boolean DEFAULT false NOT NULL,
	"is_embed_enabled" boolean DEFAULT false NOT NULL,
	"card_description" text,
	"card_platform_name" text,
	"is_web3_site" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"site_image" text,
	"regex" text DEFAULT '""' NOT NULL,
	"regex_matcher" text,
	"is_monetized" boolean DEFAULT false NOT NULL,
	"regex_options" text[],
	"color_hex" text DEFAULT '#000000',
	"platform_type_list" "platform_type"[] DEFAULT '{"social"}',
	CONSTRAINT "urlmap_siteurl_key" UNIQUE("site_url"),
	CONSTRAINT "urlmap_sitename_key" UNIQUE("site_name"),
	CONSTRAINT "urlmap_example_key" UNIQUE("example"),
	CONSTRAINT "urlmap_appstringformat_key" UNIQUE("app_string_format")
);

--> statement-breakpoint
ALTER TABLE "urlmap" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "user_tracks" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"username" text,
	"tracks" jsonb DEFAULT '[]'::jsonb,
	"top_track" text,
	"top_artist" text,
	"last_updated" timestamp with time zone,
	"artists" jsonb DEFAULT '[]'::jsonb NOT NULL
);

--> statement-breakpoint
ALTER TABLE "user_tracks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"email" text,
	"username" text,
	"username_needs_confirmation" boolean DEFAULT false NOT NULL,
	"username_prompted_at" timestamp with time zone,
	"wallet" text,
	"privy_user_id" text,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"legacy_id" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_white_listed" boolean DEFAULT false NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"legacy_link_dismissed" boolean DEFAULT false NOT NULL,
	"accepted_ugc_count" bigint,
	CONSTRAINT "users_wallet_key" UNIQUE("wallet"),
	CONSTRAINT "users_privy_user_id_key" UNIQUE("privy_user_id")
);

--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "wrap_guilds" (
	"guild_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"local_time" text,
	"posted" boolean,
	"wrap_up" jsonb,
	"shame" jsonb,
	"wrap_tracks" jsonb,
	"wrap_artists" jsonb,
	"interval" numeric,
	"channel" text
);

--> statement-breakpoint
ALTER TABLE "wrap_guilds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "artist_activity_events" ADD CONSTRAINT "artist_activity_events_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_activity_events" ADD CONSTRAINT "artist_activity_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_bio_corrections" ADD CONSTRAINT "artist_bio_corrections_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_bio_corrections" ADD CONSTRAINT "artist_bio_corrections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_bio_corrections" ADD CONSTRAINT "artist_bio_corrections_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mn_private"."artist_bio_provenance" ADD CONSTRAINT "artist_bio_provenance_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mn_private"."artist_bio_version_provenance" ADD CONSTRAINT "artist_bio_version_provenance_version_id_artist_bio_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."artist_bio_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_bio_versions" ADD CONSTRAINT "artist_bio_versions_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_claims" ADD CONSTRAINT "artist_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_claims" ADD CONSTRAINT "artist_claims_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_directory_preparations" ADD CONSTRAINT "artist_directory_preparations_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_directory_preparations" ADD CONSTRAINT "artist_directory_preparations_activity_id_artist_activity_events_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."artist_activity_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_directory_preparations" ADD CONSTRAINT "artist_directory_preparations_job_id_artist_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."artist_research_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_doc_corrections" ADD CONSTRAINT "artist_doc_corrections_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_docs" ADD CONSTRAINT "artist_docs_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_id_mappings" ADD CONSTRAINT "artist_id_mappings_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_answer_versions" ADD CONSTRAINT "artist_interview_answer_versions_answer_id_artist_interview_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."artist_interview_answers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_answer_versions" ADD CONSTRAINT "artist_interview_answer_versions_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_answer_versions" ADD CONSTRAINT "artist_interview_answer_versions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_answers" ADD CONSTRAINT "artist_interview_answers_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_boundaries" ADD CONSTRAINT "artist_interview_boundaries_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_boundaries" ADD CONSTRAINT "artist_interview_boundaries_origin_answer_id_artist_interview_answers_id_fk" FOREIGN KEY ("origin_answer_id") REFERENCES "public"."artist_interview_answers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_boundaries" ADD CONSTRAINT "artist_interview_boundaries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_boundaries" ADD CONSTRAINT "artist_interview_boundaries_activity_id_artist_activity_events_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."artist_activity_events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_boundaries" ADD CONSTRAINT "artist_interview_boundaries_retracted_by_users_id_fk" FOREIGN KEY ("retracted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_boundaries" ADD CONSTRAINT "artist_interview_boundaries_retraction_activity_id_artist_activity_events_id_fk" FOREIGN KEY ("retraction_activity_id") REFERENCES "public"."artist_activity_events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_question_evidence" ADD CONSTRAINT "artist_interview_question_evidence_answer_id_artist_interview_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."artist_interview_answers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_question_evidence" ADD CONSTRAINT "artist_interview_question_evidence_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_question_evidence" ADD CONSTRAINT "interview_evidence_session_artist" FOREIGN KEY ("session_id","artist_id") REFERENCES "public"."artist_interview_sessions"("id","artist_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_sessions" ADD CONSTRAINT "artist_interview_sessions_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_interview_sessions" ADD CONSTRAINT "artist_interview_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_latest_provider_snapshots" ADD CONSTRAINT "artist_latest_provider_snapshots_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_mapping_exclusions" ADD CONSTRAINT "artist_mapping_exclusions_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_onboarding_interview_plans" ADD CONSTRAINT "artist_onboarding_interview_plans_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_onboarding_interview_plans" ADD CONSTRAINT "artist_onboarding_interview_plans_claim_id_artist_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."artist_claims"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_onboarding_steps" ADD CONSTRAINT "artist_onboarding_steps_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_question_answers" ADD CONSTRAINT "artist_question_answers_job_id_artist_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."artist_research_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_question_answers" ADD CONSTRAINT "artist_question_answers_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_question_requests" ADD CONSTRAINT "artist_question_requests_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_question_requests" ADD CONSTRAINT "artist_question_requests_job_id_artist_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."artist_research_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_research_candidates" ADD CONSTRAINT "artist_research_candidates_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_research_candidates" ADD CONSTRAINT "artist_research_candidates_source_id_artist_vault_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."artist_vault_sources"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_research_candidates" ADD CONSTRAINT "artist_research_candidates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_research_candidates" ADD CONSTRAINT "artist_research_candidates_review_activity_id_artist_activity_events_id_fk" FOREIGN KEY ("review_activity_id") REFERENCES "public"."artist_activity_events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_research_evidence" ADD CONSTRAINT "artist_research_evidence_candidate_artist" FOREIGN KEY ("artist_id","candidate_id") REFERENCES "public"."artist_research_candidates"("artist_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_research_jobs" ADD CONSTRAINT "artist_research_jobs_activity_id_artist_activity_events_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."artist_activity_events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_research_jobs" ADD CONSTRAINT "artist_research_jobs_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_self_edits" ADD CONSTRAINT "artist_self_edits_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_self_edits" ADD CONSTRAINT "artist_self_edits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_social_credits" ADD CONSTRAINT "artist_social_credits_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_social_post_versions" ADD CONSTRAINT "artist_social_post_versions_source_id_artist_social_posts_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."artist_social_posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_social_post_versions" ADD CONSTRAINT "artist_social_post_versions_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_social_posts" ADD CONSTRAINT "artist_social_posts_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_social_profiles" ADD CONSTRAINT "artist_social_profiles_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_social_refreshes" ADD CONSTRAINT "artist_social_refreshes_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_source_assessments" ADD CONSTRAINT "artist_source_assessments_source_id_artist_vault_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."artist_vault_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_source_assessments" ADD CONSTRAINT "artist_source_assessments_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_source_assessments" ADD CONSTRAINT "artist_source_assessments_activity_id_artist_activity_events_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."artist_activity_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_vault_source_versions" ADD CONSTRAINT "artist_vault_source_versions_source_id_artist_vault_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."artist_vault_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_vault_source_versions" ADD CONSTRAINT "artist_vault_source_versions_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_vault_sources" ADD CONSTRAINT "artist_vault_sources_activity_id_artist_activity_events_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."artist_activity_events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artist_vault_sources" ADD CONSTRAINT "artist_vault_sources_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "featured" ADD CONSTRAINT "featured_featured_artist_fkey" FOREIGN KEY ("featured_artist") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "featured" ADD CONSTRAINT "featured_featured_collector_fkey" FOREIGN KEY ("featured_collector") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mn_private"."legacy_bio_publications" ADD CONSTRAINT "legacy_bio_publications_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mn_private"."legacy_bio_publications" ADD CONSTRAINT "legacy_bio_publications_claim_id_artist_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."artist_claims"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mcp_audit_log" ADD CONSTRAINT "mcp_audit_log_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ugcresearch" ADD CONSTRAINT "ugcresearch_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ugcresearch" ADD CONSTRAINT "ugcresearch_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_agent_heartbeats_updated_at" ON "agent_heartbeats" USING btree ("updated_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_runs_worker_run" ON "agent_runs" USING btree ("worker_id","run_number");
--> statement-breakpoint
CREATE INDEX "idx_agent_runs_started_at" ON "agent_runs" USING btree ("started_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "artist_activity_created_at" ON "artist_activity_events" USING btree ("created_at" DESC NULLS LAST,"id");
--> statement-breakpoint
CREATE INDEX "artist_activity_artist_created_at" ON "artist_activity_events" USING btree ("artist_id","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "artist_activity_actor_created_at" ON "artist_activity_events" USING btree ("actor_user_id","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "artist_bio_corrections_user_created" ON "artist_bio_corrections" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "artist_bio_corrections_status_created" ON "artist_bio_corrections" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "idx_artist_bio_versions_artist_id" ON "artist_bio_versions" USING btree ("artist_id" uuid_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX "artist_claims_artist_id_active_uniq" ON "artist_claims" USING btree ("artist_id" uuid_ops) WHERE status IN ('pending', 'approved');
--> statement-breakpoint
CREATE INDEX "idx_artist_claims_user_id" ON "artist_claims" USING btree ("user_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "idx_artist_claims_artist_id" ON "artist_claims" USING btree ("artist_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "idx_artist_doc_corrections_artist_id" ON "artist_doc_corrections" USING btree ("artist_id" uuid_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX "artist_doc_corrections_artist_claim_uniq" ON "artist_doc_corrections" USING btree ("artist_id","claim");
--> statement-breakpoint
CREATE INDEX "idx_artist_id_mappings_platform_artist" ON "artist_id_mappings" USING btree ("platform","artist_id");
--> statement-breakpoint
CREATE INDEX "idx_artist_id_mappings_confidence" ON "artist_id_mappings" USING btree ("confidence");
--> statement-breakpoint
CREATE INDEX "artist_interview_answer_versions_artist" ON "artist_interview_answer_versions" USING btree ("artist_id");
--> statement-breakpoint
CREATE INDEX "idx_artist_interview_answers_artist_id" ON "artist_interview_answers" USING btree ("artist_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "artist_interview_boundaries_active" ON "artist_interview_boundaries" USING btree ("artist_id","sitting") WHERE "artist_interview_boundaries"."retracted_at" is null;
--> statement-breakpoint
CREATE INDEX "artist_interview_boundaries_origin" ON "artist_interview_boundaries" USING btree ("origin_answer_id");
--> statement-breakpoint
CREATE INDEX "artist_interview_boundaries_creator" ON "artist_interview_boundaries" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX "artist_interview_boundaries_retractor" ON "artist_interview_boundaries" USING btree ("retracted_by");
--> statement-breakpoint
CREATE INDEX "artist_interview_boundaries_activity" ON "artist_interview_boundaries" USING btree ("activity_id");
--> statement-breakpoint
CREATE INDEX "artist_interview_boundaries_retraction_activity" ON "artist_interview_boundaries" USING btree ("retraction_activity_id");
--> statement-breakpoint
CREATE INDEX "artist_interview_evidence_artist" ON "artist_interview_question_evidence" USING btree ("artist_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "artist_interview_sessions_active" ON "artist_interview_sessions" USING btree ("artist_id") WHERE "artist_interview_sessions"."state" = 'active';
--> statement-breakpoint
CREATE INDEX "artist_interview_sessions_creator" ON "artist_interview_sessions" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX "idx_artist_mapping_exclusions_platform" ON "artist_mapping_exclusions" USING btree ("platform");
--> statement-breakpoint
CREATE INDEX "idx_artist_onboarding_steps_artist_id" ON "artist_onboarding_steps" USING btree ("artist_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "artist_question_answers_expiry" ON "artist_question_answers" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "artist_question_requests_expiry" ON "artist_question_requests" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "artist_research_candidates_review" ON "artist_research_candidates" USING btree ("artist_id","curation","id");
--> statement-breakpoint
CREATE INDEX "artist_research_evidence_latest" ON "artist_research_evidence" USING btree ("candidate_id","retrieved_at","id");
--> statement-breakpoint
CREATE INDEX "artist_research_evidence_artist" ON "artist_research_evidence" USING btree ("artist_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "artist_research_jobs_one_live" ON "artist_research_jobs" USING btree ("artist_id","kind") WHERE "artist_research_jobs"."status" in ('pending', 'running');
--> statement-breakpoint
CREATE UNIQUE INDEX "artist_research_jobs_auto_source_live" ON "artist_research_jobs" USING btree ("artist_id",("state"->>'autoSourceId')) WHERE "artist_research_jobs"."kind" = 'source_extract' and "artist_research_jobs"."state"->>'version' = '2' and "artist_research_jobs"."status" in ('queued','pending','running');
--> statement-breakpoint
CREATE UNIQUE INDEX "artist_research_jobs_catalog_single_worker" ON "artist_research_jobs" USING btree ("kind") WHERE "artist_research_jobs"."kind" = 'catalog_match' and "artist_research_jobs"."status" = 'running';
--> statement-breakpoint
CREATE INDEX "artist_research_jobs_catalog_anchor" ON "artist_research_jobs" USING btree ("artist_id",("state"->'anchor')) WHERE "artist_research_jobs"."kind" = 'catalog_match';
--> statement-breakpoint
CREATE INDEX "artist_research_jobs_question_created" ON "artist_research_jobs" USING btree ("created_at") WHERE "artist_research_jobs"."kind" = 'question_research';
--> statement-breakpoint
CREATE INDEX "artist_research_jobs_claimable" ON "artist_research_jobs" USING btree ("status","claimed_at","created_at");
--> statement-breakpoint
CREATE INDEX "artist_self_edits_user_time_idx" ON "artist_self_edits" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "artist_self_edits_time_idx" ON "artist_self_edits" USING btree ("created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "idx_artist_social_credits_artist" ON "artist_social_credits" USING btree ("artist_id","kind");
--> statement-breakpoint
CREATE INDEX "artist_social_post_versions_artist" ON "artist_social_post_versions" USING btree ("artist_id");
--> statement-breakpoint
CREATE INDEX "idx_artist_social_posts_artist_id" ON "artist_social_posts" USING btree ("artist_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "idx_artist_social_posts_own" ON "artist_social_posts" USING btree ("artist_id","is_own_post");
--> statement-breakpoint
CREATE INDEX "idx_artist_social_profiles_artist_id" ON "artist_social_profiles" USING btree ("artist_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "artist_source_assessments_artist" ON "artist_source_assessments" USING btree ("artist_id");
--> statement-breakpoint
CREATE INDEX "artist_vault_source_versions_artist" ON "artist_vault_source_versions" USING btree ("artist_id");
--> statement-breakpoint
CREATE INDEX "idx_artist_vault_sources_artist_id" ON "artist_vault_sources" USING btree ("artist_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "artists_added_by_created_at_idx" ON "artists" USING btree ("added_by" timestamptz_ops,"created_at" timestamptz_ops);
--> statement-breakpoint
CREATE INDEX "artists_lcname_btree_idx" ON "artists" USING btree ("lcname" text_ops);
--> statement-breakpoint
CREATE INDEX "artists_lcname_trgm_gin" ON "artists" USING gin ("lcname" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "artists_lcname_trgm_idx" ON "artists" USING gist ("lcname" gist_trgm_ops);
--> statement-breakpoint
CREATE INDEX "artists_name_trgm_idx" ON "artists" USING gist ("name" gist_trgm_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX "artists_spotify_uniq" ON "artists" USING btree ("spotify" text_ops) WHERE (spotify IS NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX "artists_deezer_uniq" ON "artists" USING btree ("deezer" text_ops) WHERE (deezer IS NOT NULL);
--> statement-breakpoint
CREATE INDEX "artists_music_bandcamp_owner_idx" ON "artists" USING btree (lower(ltrim(btrim("bandcamp"), '@')));
--> statement-breakpoint
CREATE INDEX "artists_music_subvert_owner_idx" ON "artists" USING btree (lower(ltrim(btrim("subvert"), '@')));
--> statement-breakpoint
CREATE INDEX "artists_music_supercollector_owner_idx" ON "artists" USING btree (regexp_replace(lower(ltrim(btrim("supercollector"), '@')), '[.]eth$', ''));
--> statement-breakpoint
CREATE INDEX "artists_music_soundcloud_owner_idx" ON "artists" USING btree (lower(ltrim(btrim("soundcloud"), '@')));
--> statement-breakpoint
CREATE INDEX "artists_music_audius_owner_idx" ON "artists" USING btree (lower(ltrim(btrim("audius"), '@')));
--> statement-breakpoint
CREATE INDEX "artists_music_mixcloud_owner_idx" ON "artists" USING btree (lower(ltrim(btrim("mixcloud"), '@')));
--> statement-breakpoint
CREATE INDEX "idx_artists_added_by" ON "artists" USING btree ("added_by" uuid_ops);
--> statement-breakpoint
CREATE INDEX "idx_artists_name" ON "artists" USING btree ("name" text_ops);
--> statement-breakpoint
CREATE INDEX "idx_artists_name_gin" ON "artists" USING gin (to_tsvector('english'::regconfig, name));
--> statement-breakpoint
CREATE INDEX "idx_artists_created_at" ON "artists" USING btree ("created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "idx_mcp_audit_log_artist_id" ON "mcp_audit_log" USING btree ("artist_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "idx_mcp_audit_log_created_at" ON "mcp_audit_log" USING btree ("created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "idx_mcp_audit_log_api_key_hash_created_at" ON "mcp_audit_log" USING btree ("api_key_hash","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "question_planning_admissions_visitor_time" ON "question_planning_admissions" USING btree ("visitor_key","admitted_at");
--> statement-breakpoint
CREATE INDEX "question_planning_admissions_time" ON "question_planning_admissions" USING btree ("admitted_at");
--> statement-breakpoint
CREATE INDEX "idx_ugcresearch_user_id" ON "ugcresearch" USING btree ("user_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "ugcresearch_user_created_at_idx" ON "ugcresearch" USING btree ("user_id" timestamp_ops,"created_at" timestamp_ops);
--> statement-breakpoint
CREATE INDEX "idx_ugcresearch_date_processed" ON "ugcresearch" USING btree ("date_processed" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "idx_user_tracks_guild_id" ON "user_tracks" USING btree ("guild_id" text_ops);
--> statement-breakpoint
CREATE INDEX "idx_user_tracks_user_id" ON "user_tracks" USING btree ("user_id" text_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_public_username_unique" ON "users" USING btree (lower(btrim("username"))) WHERE nullif(btrim("users"."username"), '') is not null and "users"."username" !~ '[^[:space:]@]+@[^[:space:]@]+' and lower(btrim("users"."username")) is distinct from lower(btrim("users"."wallet"));
--> statement-breakpoint
CREATE POLICY "mnweb_select_account_merges" ON "account_merge_events" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_agent_heartbeats" ON "agent_heartbeats" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_agent_heartbeats" ON "agent_heartbeats" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_agent_heartbeats" ON "agent_heartbeats" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_agent_runs" ON "agent_runs" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_agent_runs" ON "agent_runs" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_agent_runs" ON "agent_runs" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_aiprompts" ON "aiprompts" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_aiprompts" ON "aiprompts" AS PERMISSIVE FOR INSERT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_select_aiprompts" ON "aiprompts" AS PERMISSIVE FOR SELECT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_update_aiprompts" ON "aiprompts" AS PERMISSIVE FOR UPDATE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_activity" ON "artist_activity_events" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_activity" ON "artist_activity_events" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_bio_corrections" ON "artist_bio_corrections" AS PERMISSIVE FOR ALL TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_artist_bio_provenance" ON "mn_private"."artist_bio_provenance" AS PERMISSIVE FOR ALL TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_artist_bio_version_provenance" ON "mn_private"."artist_bio_version_provenance" AS PERMISSIVE FOR ALL TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_bio_versions" ON "artist_bio_versions" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_bio_versions" ON "artist_bio_versions" AS PERMISSIVE FOR INSERT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_bio_versions" ON "artist_bio_versions" AS PERMISSIVE FOR UPDATE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_bio_versions" ON "artist_bio_versions" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_claims" ON "artist_claims" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_claims" ON "artist_claims" AS PERMISSIVE FOR INSERT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_claims" ON "artist_claims" AS PERMISSIVE FOR SELECT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_claims" ON "artist_claims" AS PERMISSIVE FOR UPDATE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_directory_preparations" ON "artist_directory_preparations" AS PERMISSIVE FOR ALL TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_doc_corrections" ON "artist_doc_corrections" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_doc_corrections" ON "artist_doc_corrections" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_doc_corrections" ON "artist_doc_corrections" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_doc_corrections" ON "artist_doc_corrections" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_docs" ON "artist_docs" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_docs" ON "artist_docs" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_docs" ON "artist_docs" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_docs" ON "artist_docs" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_id_mappings" ON "artist_id_mappings" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_id_mappings" ON "artist_id_mappings" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_id_mappings" ON "artist_id_mappings" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_interview_answer_versions" ON "artist_interview_answer_versions" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_interview_answer_versions" ON "artist_interview_answer_versions" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_interview_answers" ON "artist_interview_answers" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_interview_answers" ON "artist_interview_answers" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_interview_answers" ON "artist_interview_answers" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_interview_answers" ON "artist_interview_answers" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_interview_boundaries" ON "artist_interview_boundaries" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_interview_boundaries" ON "artist_interview_boundaries" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_retract_artist_interview_boundaries" ON "artist_interview_boundaries" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_read_interview_evidence" ON "artist_interview_question_evidence" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_create_interview_evidence" ON "artist_interview_question_evidence" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_read_interview_sessions" ON "artist_interview_sessions" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_create_interview_sessions" ON "artist_interview_sessions" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_close_interview_sessions" ON "artist_interview_sessions" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_latest_provider_snapshots" ON "artist_latest_provider_snapshots" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_latest_provider_snapshots" ON "artist_latest_provider_snapshots" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_latest_provider_snapshots" ON "artist_latest_provider_snapshots" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_mapping_exclusions" ON "artist_mapping_exclusions" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_mapping_exclusions" ON "artist_mapping_exclusions" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_mapping_exclusions" ON "artist_mapping_exclusions" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_onboarding_interview_plans" ON "artist_onboarding_interview_plans" AS PERMISSIVE FOR ALL TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_onboarding_steps" ON "artist_onboarding_steps" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_onboarding_steps" ON "artist_onboarding_steps" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_onboarding_steps" ON "artist_onboarding_steps" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_question_answers" ON "artist_question_answers" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_question_answers" ON "artist_question_answers" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_question_answers" ON "artist_question_answers" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_question_answers" ON "artist_question_answers" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_question_requests" ON "artist_question_requests" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_question_requests" ON "artist_question_requests" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_question_requests" ON "artist_question_requests" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_question_requests" ON "artist_question_requests" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_research_candidates" ON "artist_research_candidates" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_research_candidates" ON "artist_research_candidates" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_research_candidates" ON "artist_research_candidates" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_research_candidates" ON "artist_research_candidates" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_research_evidence" ON "artist_research_evidence" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_research_evidence" ON "artist_research_evidence" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_research_jobs" ON "artist_research_jobs" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_research_jobs" ON "artist_research_jobs" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_research_jobs" ON "artist_research_jobs" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_research_jobs" ON "artist_research_jobs" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_self_edits" ON "artist_self_edits" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_reassign_artist_self_edits" ON "artist_self_edits" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_self_edits" ON "artist_self_edits" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_social_credits" ON "artist_social_credits" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_social_credits" ON "artist_social_credits" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_social_credits" ON "artist_social_credits" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_social_credits" ON "artist_social_credits" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_social_post_versions" ON "artist_social_post_versions" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_social_post_versions" ON "artist_social_post_versions" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_social_posts" ON "artist_social_posts" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_social_posts" ON "artist_social_posts" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_social_posts" ON "artist_social_posts" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_social_posts" ON "artist_social_posts" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_social_profiles" ON "artist_social_profiles" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_social_profiles" ON "artist_social_profiles" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_social_profiles" ON "artist_social_profiles" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_social_profiles" ON "artist_social_profiles" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_social_refreshes" ON "artist_social_refreshes" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_social_refreshes" ON "artist_social_refreshes" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_social_refreshes" ON "artist_social_refreshes" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_social_refreshes" ON "artist_social_refreshes" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_source_assessments" ON "artist_source_assessments" AS PERMISSIVE FOR ALL TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_vault_source_versions" ON "artist_vault_source_versions" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_vault_source_versions" ON "artist_vault_source_versions" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artist_vault_sources" ON "artist_vault_sources" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artist_vault_sources" ON "artist_vault_sources" AS PERMISSIVE FOR INSERT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_select_artist_vault_sources" ON "artist_vault_sources" AS PERMISSIVE FOR SELECT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_update_artist_vault_sources" ON "artist_vault_sources" AS PERMISSIVE FOR UPDATE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "Allow webmapdata_editor to see all rows" ON "artists" AS PERMISSIVE FOR SELECT TO "webmapdata_editor" USING (true);
--> statement-breakpoint
CREATE POLICY "Allow webmapdata_editor to update webmapdata column" ON "artists" AS PERMISSIVE FOR UPDATE TO "webmapdata_editor";
--> statement-breakpoint
CREATE POLICY "mnweb_delete_artists" ON "artists" AS PERMISSIVE FOR DELETE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_insert_artists" ON "artists" AS PERMISSIVE FOR INSERT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_select_artists" ON "artists" AS PERMISSIVE FOR SELECT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_update_artists" ON "artists" AS PERMISSIVE FOR UPDATE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mn_bot_bot_prompts_sel" ON "bot_prompts" AS PERMISSIVE FOR SELECT TO "mn_bot" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_featured" ON "featured" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_featured" ON "featured" AS PERMISSIVE FOR INSERT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_select_featured" ON "featured" AS PERMISSIVE FOR SELECT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_update_featured" ON "featured" AS PERMISSIVE FOR UPDATE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mn_bot_history_ins" ON "history" AS PERMISSIVE FOR INSERT TO "mn_bot" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mn_bot_history_sel" ON "history" AS PERMISSIVE FOR SELECT TO "mn_bot";
--> statement-breakpoint
CREATE POLICY "mn_bot_history_upd" ON "history" AS PERMISSIVE FOR UPDATE TO "mn_bot";
--> statement-breakpoint
CREATE POLICY "mnweb_legacy_bio_publications_select" ON "mn_private"."legacy_bio_publications" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_mcp_api_keys" ON "mcp_api_keys" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_mcp_api_keys" ON "mcp_api_keys" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_mcp_api_keys" ON "mcp_api_keys" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_mcp_audit_log" ON "mcp_audit_log" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_mcp_audit_log" ON "mcp_audit_log" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_provider_request_cooldowns" ON "provider_request_cooldowns" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_provider_request_cooldowns" ON "provider_request_cooldowns" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_update_provider_request_cooldowns" ON "provider_request_cooldowns" AS PERMISSIVE FOR UPDATE TO "mnweb" USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_public_url_receipts_select" ON "mn_private"."public_url_receipts" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_public_url_receipts_insert" ON "mn_private"."public_url_receipts" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_select_question_planning_admissions" ON "question_planning_admissions" AS PERMISSIVE FOR SELECT TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_question_planning_admissions" ON "question_planning_admissions" AS PERMISSIVE FOR INSERT TO "mnweb" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_question_planning_admissions" ON "question_planning_admissions" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_delete_ugcresearch" ON "ugcresearch" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_ugcresearch" ON "ugcresearch" AS PERMISSIVE FOR INSERT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_select_ugcresearch" ON "ugcresearch" AS PERMISSIVE FOR SELECT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_update_ugcresearch" ON "ugcresearch" AS PERMISSIVE FOR UPDATE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_delete_urlmap" ON "urlmap" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_urlmap" ON "urlmap" AS PERMISSIVE FOR INSERT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_select_urlmap" ON "urlmap" AS PERMISSIVE FOR SELECT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_update_urlmap" ON "urlmap" AS PERMISSIVE FOR UPDATE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mn_bot_user_tracks_ins" ON "user_tracks" AS PERMISSIVE FOR INSERT TO "mn_bot" WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "mn_bot_user_tracks_sel" ON "user_tracks" AS PERMISSIVE FOR SELECT TO "mn_bot";
--> statement-breakpoint
CREATE POLICY "mn_bot_user_tracks_upd" ON "user_tracks" AS PERMISSIVE FOR UPDATE TO "mn_bot";
--> statement-breakpoint
CREATE POLICY "mnweb_delete_users" ON "users" AS PERMISSIVE FOR DELETE TO "mnweb" USING (true);
--> statement-breakpoint
CREATE POLICY "mnweb_insert_users" ON "users" AS PERMISSIVE FOR INSERT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_select_users" ON "users" AS PERMISSIVE FOR SELECT TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mnweb_update_users" ON "users" AS PERMISSIVE FOR UPDATE TO "mnweb";
--> statement-breakpoint
CREATE POLICY "mn_bot_wrap_guilds_del" ON "wrap_guilds" AS PERMISSIVE FOR DELETE TO "mn_bot" USING (true);
--> statement-breakpoint
CREATE POLICY "mn_bot_wrap_guilds_ins" ON "wrap_guilds" AS PERMISSIVE FOR INSERT TO "mn_bot";
--> statement-breakpoint
CREATE POLICY "mn_bot_wrap_guilds_sel" ON "wrap_guilds" AS PERMISSIVE FOR SELECT TO "mn_bot";
--> statement-breakpoint
CREATE POLICY "mn_bot_wrap_guilds_upd" ON "wrap_guilds" AS PERMISSIVE FOR UPDATE TO "mn_bot";
