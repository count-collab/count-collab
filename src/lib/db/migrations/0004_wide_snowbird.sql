CREATE TABLE IF NOT EXISTS "dashboard_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"counter_id" uuid NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"size_columns" integer DEFAULT 1 NOT NULL,
	"size_rows" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dashboard_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"visibility_mode" text DEFAULT 'public' NOT NULL,
	"share_token" text,
	"owner_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboards_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dashboard_items_dashboard_id_idx" ON "dashboard_items" ("dashboard_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_members_dashboard_user_idx" ON "dashboard_members" ("dashboard_id","user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_items" ADD CONSTRAINT "dashboard_items_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_items" ADD CONSTRAINT "dashboard_items_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_members" ADD CONSTRAINT "dashboard_members_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_members" ADD CONSTRAINT "dashboard_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
