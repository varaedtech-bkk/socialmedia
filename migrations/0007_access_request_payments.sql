ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" text DEFAULT null;
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text DEFAULT null;
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text DEFAULT null;
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp DEFAULT null;
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "paid_at" timestamp DEFAULT null;
