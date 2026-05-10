CREATE TABLE IF NOT EXISTS "platform_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"user_id" text,
	"entity_id" text,
	"entity_type" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_events_event_type_created_at_idx" ON "platform_events" ("event_type", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_events_user_event_type_created_at_idx" ON "platform_events" ("user_id", "event_type", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_events_created_at_brin_idx" ON "platform_events" USING brin ("created_at");