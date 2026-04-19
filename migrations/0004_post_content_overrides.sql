ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "content_overrides" json DEFAULT '{}'::json NOT NULL;

