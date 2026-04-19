ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_approved" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "package_tier" text DEFAULT 'basic' NOT NULL;

CREATE TABLE IF NOT EXISTS "access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"company" text,
	"message" text,
	"package_tier_requested" text DEFAULT 'basic' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "access_requests_email_idx" ON "access_requests" ("email");
CREATE INDEX IF NOT EXISTS "access_requests_status_idx" ON "access_requests" ("status");

DO $$
BEGIN
 ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_approved_user_id_users_id_fk"
   FOREIGN KEY ("approved_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
