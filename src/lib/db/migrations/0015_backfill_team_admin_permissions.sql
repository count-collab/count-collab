INSERT INTO "permissions" ("name", "description") VALUES
  ('team:edit_any', 'Edit/manage any team'),
  ('team:delete_any', 'Delete any team')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."name" IN ('team:edit_any', 'team:delete_any')
WHERE r."name" = 'admin'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
