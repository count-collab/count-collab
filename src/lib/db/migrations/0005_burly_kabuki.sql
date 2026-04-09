CREATE TABLE IF NOT EXISTS "counter_followers" (
	"id" serial PRIMARY KEY NOT NULL,
	"counter_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"followed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dashboard_followers" (
	"id" serial PRIMARY KEY NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"followed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "counter_followers_counter_user_idx" ON "counter_followers" ("counter_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_followers_dashboard_user_idx" ON "dashboard_followers" ("dashboard_id","user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "counter_followers" ADD CONSTRAINT "counter_followers_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "counter_followers" ADD CONSTRAINT "counter_followers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_followers" ADD CONSTRAINT "dashboard_followers_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_followers" ADD CONSTRAINT "dashboard_followers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
