CREATE TABLE IF NOT EXISTS "counter_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"counter_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"reached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"counter_creation_limit_auth" integer DEFAULT 5 NOT NULL,
	"counter_creation_window_auth" integer DEFAULT 60 NOT NULL,
	"counter_creation_limit_unauth" integer DEFAULT 2 NOT NULL,
	"counter_creation_window_unauth" integer DEFAULT 60 NOT NULL,
	"dashboard_creation_limit_auth" integer DEFAULT 5 NOT NULL,
	"dashboard_creation_window_auth" integer DEFAULT 60 NOT NULL,
	"dashboard_creation_limit_unauth" integer DEFAULT 2 NOT NULL,
	"dashboard_creation_window_unauth" integer DEFAULT 60 NOT NULL,
	"increment_cooldown_ms_auth" integer DEFAULT 5000 NOT NULL,
	"increment_cooldown_ms_unauth" integer DEFAULT 30000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counters"
ADD COLUMN IF NOT EXISTS "cooldown_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "counters"
ADD COLUMN IF NOT EXISTS "cooldown_seconds" integer DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE "counters"
ADD COLUMN IF NOT EXISTS "goals_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "counters"
ADD COLUMN IF NOT EXISTS "scoreboard_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "counter_goals_counter_amount_idx" ON "counter_goals" ("counter_id", "amount");
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "counter_goals"
ADD CONSTRAINT "counter_goals_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object THEN null;
END $$;