ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "device_hash" text DEFAULT null;
