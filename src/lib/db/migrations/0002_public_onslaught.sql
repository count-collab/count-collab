ALTER TABLE "counters"
ADD COLUMN IF NOT EXISTS "share_token" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "counter_history_counter_id_changed_at_idx" ON "counter_history" ("counter_id", "changed_at");
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "counters"
ADD CONSTRAINT "counters_share_token_unique" UNIQUE("share_token");
EXCEPTION
WHEN duplicate_object THEN null;
END $$;