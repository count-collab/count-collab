CREATE TABLE IF NOT EXISTS "roles" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "roles"
ADD CONSTRAINT "roles_name_unique" UNIQUE("name");
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "permissions"
ADD CONSTRAINT "permissions_name_unique" UNIQUE("name");
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "email" text,
  "emailVerified" timestamp,
  "image" text,
  "username" text,
  "role_id" integer
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "user"
ADD CONSTRAINT "user_email_unique" UNIQUE("email");
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "user"
ADD CONSTRAINT "user_username_unique" UNIQUE("username");
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "user"
ADD CONSTRAINT "user_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
  "userId" text NOT NULL,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "providerAccountId" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider", "providerAccountId")
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "account"
ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
  "sessionToken" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "expires" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "session"
ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verificationToken" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp NOT NULL,
  CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier", "token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id" integer NOT NULL,
  "permission_id" integer NOT NULL,
  CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id", "permission_id")
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "role_permissions"
ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "role_permissions"
ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "counter_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "counter_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "role" text DEFAULT 'viewer' NOT NULL,
  "invited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "counter_members_counter_user_idx" ON "counter_members" ("counter_id", "user_id");
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "counter_members"
ADD CONSTRAINT "counter_members_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "counter_members"
ADD CONSTRAINT "counter_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "counter_history"
ADD COLUMN IF NOT EXISTS "changed_by" text;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "counter_history"
ADD CONSTRAINT "counter_history_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "user"("id") ON DELETE
set null ON UPDATE no action;
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "counters"
ADD COLUMN IF NOT EXISTS "owner_id" text;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "counters"
ADD CONSTRAINT "counters_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE
set null ON UPDATE no action;
EXCEPTION
WHEN duplicate_object
OR duplicate_table THEN null;
END $$;