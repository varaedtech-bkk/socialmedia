UPDATE "company_memberships" cm
SET "role" = 'moderator',
    "updated_at" = now()
FROM "users" u, "companies" c
WHERE cm."user_id" = u."id"
  AND c."id" = cm."company_id"
  AND c."slug" = 'default-company'
  AND u."role" = 'client'
  AND cm."role" = 'owner'
  AND (c."owner_user_id" IS NULL OR c."owner_user_id" <> u."id");
