CREATE TABLE IF NOT EXISTS "companies" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "package_tier" text DEFAULT 'basic' NOT NULL,
  "openrouter_api_key" text DEFAULT null,
  "owner_user_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);

CREATE INDEX IF NOT EXISTS "companies_slug_idx" ON "companies" ("slug");
CREATE INDEX IF NOT EXISTS "companies_owner_user_id_idx" ON "companies" ("owner_user_id");

DO $$
BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_user_id_users_id_fk"
   FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "company_memberships" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "role" text DEFAULT 'moderator' NOT NULL,
  "ai_enabled" boolean DEFAULT true NOT NULL,
  "allowed_platforms" json DEFAULT '[]'::json NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_memberships_company_user_unique"
  ON "company_memberships" ("company_id", "user_id");
CREATE INDEX IF NOT EXISTS "company_memberships_user_idx"
  ON "company_memberships" ("user_id");

DO $$
BEGIN
 ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_companies_id_fk"
   FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
 ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer,
  "changed_by_user_id" integer,
  "target_user_id" integer,
  "action" text NOT NULL,
  "old_value" json DEFAULT null,
  "new_value" json DEFAULT null,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_logs_company_created_idx"
  ON "audit_logs" ("company_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_target_user_idx"
  ON "audit_logs" ("target_user_id");

DO $$
BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk"
   FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_changed_by_user_id_users_id_fk"
   FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_users_id_fk"
   FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: one default company and memberships for all existing users.
DO $$
DECLARE
  default_company_id integer;
BEGIN
  INSERT INTO "companies" ("name", "slug", "package_tier")
  VALUES ('Default Company', 'default-company', 'advance')
  ON CONFLICT ("slug") DO NOTHING;

  SELECT "id" INTO default_company_id FROM "companies" WHERE "slug" = 'default-company' LIMIT 1;

  IF default_company_id IS NOT NULL THEN
    INSERT INTO "company_memberships" ("company_id", "user_id", "role", "ai_enabled", "allowed_platforms")
    SELECT
      default_company_id,
      u."id",
      CASE WHEN u."role" = 'super_admin' THEN 'owner'
           ELSE 'moderator'
      END,
      true,
      '["linkedin","twitter","facebook-page","instagram","tiktok","youtube","pinterest","snapchat","whatsapp"]'::json
    FROM "users" u
    WHERE u."is_deleted" = false
    ON CONFLICT ("company_id", "user_id") DO NOTHING;

    UPDATE "companies"
    SET "owner_user_id" = (
      SELECT cm."user_id"
      FROM "company_memberships" cm
      WHERE cm."company_id" = default_company_id
      ORDER BY CASE cm."role"
        WHEN 'owner' THEN 0
        ELSE 2
      END,
      cm."id" ASC
      LIMIT 1
    ),
    "updated_at" = now()
    WHERE "id" = default_company_id
      AND "owner_user_id" IS NULL;
  END IF;
END $$;
