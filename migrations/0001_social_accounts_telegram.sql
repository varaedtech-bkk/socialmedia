-- Multi-account social + Telegram user mapping
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_chat_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_chat_id_unique"
  ON "users" ("telegram_chat_id")
  WHERE "telegram_chat_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "social_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"external_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"metadata" json DEFAULT '{}'::json,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "social_accounts_user_platform_idx" ON "social_accounts" ("user_id","platform");
CREATE INDEX IF NOT EXISTS "social_accounts_user_external_idx" ON "social_accounts" ("user_id","platform","external_id");

DO $$
BEGIN
 ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
