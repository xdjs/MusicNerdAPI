-- Vendored from MusicNerdWeb drizzle/0066_source_units.sql: its five source_units statements
-- (the table, its artist foreign key and its three indexes), byte for byte, for
-- searchUnitsByVector.postgres.test.ts. It must track drizzle/0066_source_units.sql: when a
-- migration changes source_units, copy the changed statements here.
--> statement-breakpoint
CREATE TABLE "source_units" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"source_revision" text NOT NULL,
	"unit_index" integer NOT NULL,
	"locator" text NOT NULL,
	"title" text,
	"url" text,
	"text" text NOT NULL,
	"text_hash" text NOT NULL,
	"tokens" integer NOT NULL,
	"ocr" boolean DEFAULT false NOT NULL,
	"ingest_version" integer NOT NULL,
	"search" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("title", '') || ' ' || "text")) STORED NOT NULL,
	"embedding" extensions.vector(1536),
	"created_at" timestamp with time zone DEFAULT (now() at time zone 'utc') NOT NULL,
	CONSTRAINT "source_units_source_unit" UNIQUE("source_kind","source_id","unit_index"),
	CONSTRAINT "source_units_source_kind" CHECK ("source_units"."source_kind" IN ('vault','social','evidence'))
);
--> statement-breakpoint
ALTER TABLE "source_units" ADD CONSTRAINT "source_units_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "source_units_artist" ON "source_units" USING btree ("artist_id","source_kind","source_id");
--> statement-breakpoint
CREATE INDEX "source_units_search" ON "source_units" USING gin ("search");
--> statement-breakpoint
CREATE INDEX "source_units_embedding" ON "source_units" USING hnsw ("embedding" extensions.vector_cosine_ops);
