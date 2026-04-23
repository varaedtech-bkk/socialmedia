CREATE TABLE IF NOT EXISTS "agent_channel_users" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "channel" text NOT NULL,
  "channel_user_id" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_channel_users_channel_identity_unique"
  ON "agent_channel_users" ("channel", "channel_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_channel_users_company_user_channel_unique"
  ON "agent_channel_users" ("company_id", "user_id", "channel");
CREATE INDEX IF NOT EXISTS "agent_channel_users_company_idx"
  ON "agent_channel_users" ("company_id");
CREATE INDEX IF NOT EXISTS "agent_channel_users_user_idx"
  ON "agent_channel_users" ("user_id");

DO $$
BEGIN
 ALTER TABLE "agent_channel_users" ADD CONSTRAINT "agent_channel_users_company_id_companies_id_fk"
   FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
 ALTER TABLE "agent_channel_users" ADD CONSTRAINT "agent_channel_users_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

-- Backfill existing Telegram links from users.telegram_chat_id
INSERT INTO "agent_channel_users" ("company_id", "user_id", "channel", "channel_user_id", "is_active")
SELECT
  cm."company_id",
  u."id",
  'telegram',
  u."telegram_chat_id",
  true
FROM "users" u
INNER JOIN "company_memberships" cm ON cm."user_id" = u."id" AND cm."is_active" = true
WHERE u."telegram_chat_id" IS NOT NULL
ON CONFLICT ("channel", "channel_user_id") DO UPDATE
SET
  "user_id" = EXCLUDED."user_id",
  "company_id" = EXCLUDED."company_id",
  "is_active" = true,
  "updated_at" = now();
