ALTER TABLE "counters" ADD COLUMN "share_token" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "counter_history_counter_id_changed_at_idx" ON "counter_history" ("counter_id","changed_at");--> statement-breakpoint
ALTER TABLE "counters" ADD CONSTRAINT "counters_share_token_unique" UNIQUE("share_token");