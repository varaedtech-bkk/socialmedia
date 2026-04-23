-- Simplify global user roles to: super_admin | client
UPDATE "users"
SET "role" = 'client',
    "updated_at" = now()
WHERE "role" IN ('user', 'admin');

-- Simplify company membership roles to: owner | moderator
UPDATE "company_memberships"
SET "role" = 'owner',
    "updated_at" = now()
WHERE "role" = 'owner_admin';

UPDATE "company_memberships"
SET "role" = 'moderator',
    "updated_at" = now()
WHERE "role" = 'admin';

-- Any unknown/legacy role becomes moderator for safety.
UPDATE "company_memberships"
SET "role" = 'moderator',
    "updated_at" = now()
WHERE "role" NOT IN ('owner', 'moderator');
