CREATE TABLE IF NOT EXISTS "counter_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"counter_id" uuid NOT NULL,
	"previous_value" integer NOT NULL,
	"new_value" integer NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"count" integer DEFAULT 0 NOT NULL,
	"is_public" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "counter_history" ADD CONSTRAINT "counter_history_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
