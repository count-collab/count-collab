CREATE TABLE IF NOT EXISTS "counter_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"counter_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"invited_by" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dashboard_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"invited_by" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "counter_invitations_counter_user_idx" ON "counter_invitations" ("counter_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "counter_invitations_user_id_idx" ON "counter_invitations" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_invitations_dashboard_user_idx" ON "dashboard_invitations" ("dashboard_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dashboard_invitations_user_id_idx" ON "dashboard_invitations" ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "counter_invitations" ADD CONSTRAINT "counter_invitations_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "counter_invitations" ADD CONSTRAINT "counter_invitations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "counter_invitations" ADD CONSTRAINT "counter_invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_invitations" ADD CONSTRAINT "dashboard_invitations_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_invitations" ADD CONSTRAINT "dashboard_invitations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_invitations" ADD CONSTRAINT "dashboard_invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
