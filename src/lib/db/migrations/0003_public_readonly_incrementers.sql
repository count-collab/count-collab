ALTER TABLE "counters"
ADD COLUMN IF NOT EXISTS "visibility_mode" text DEFAULT 'public';
--> statement-breakpoint
UPDATE "counters"
SET "visibility_mode" = CASE
  WHEN "is_public" = 0 THEN 'private'
  ELSE 'public'
END
WHERE "visibility_mode" IS NULL OR "visibility_mode" = 'public';
--> statement-breakpoint
ALTER TABLE "counters"
ALTER COLUMN "visibility_mode" SET NOT NULL;
