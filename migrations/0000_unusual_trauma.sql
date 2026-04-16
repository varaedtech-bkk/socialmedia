CREATE TABLE "platform_rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"window_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"scheduled_time" timestamp DEFAULT null,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"platforms" json DEFAULT '["facebook-page"]'::json NOT NULL,
	"media_urls" json DEFAULT '[]'::json NOT NULL,
	"media_type" text DEFAULT null,
	"analytics" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"counted_for_quota" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "subscription_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"monthly_price" integer NOT NULL,
	"yearly_price" integer NOT NULL,
	"posts_limit" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_tiers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"tier_id" integer NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"posts_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"canceled_at" timestamp DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"stripe_customer_id" text DEFAULT null,
	"facebook_page_token" text DEFAULT null,
	"facebook_personal_token" text DEFAULT null,
	"facebook_page_id" text DEFAULT null,
	"instagram_token" text DEFAULT null,
	"linkedin_token" text DEFAULT null,
	"linkedin_page_token" text DEFAULT null,
	"linkedin_user_profile" json DEFAULT null,
	"linkedin_page_urn" text DEFAULT null,
	"instagram_user_profile" json DEFAULT null,
	"instagram_business_account_id" text DEFAULT null,
	"twitter_token" text DEFAULT null,
	"twitter_user_profile" json DEFAULT null,
	"youtube_token" text DEFAULT null,
	"youtube_user_profile" json DEFAULT null,
	"tiktok_token" text DEFAULT null,
	"tiktok_user_profile" json DEFAULT null,
	"pinterest_token" text DEFAULT null,
	"pinterest_user_profile" json DEFAULT null,
	"snapchat_token" text DEFAULT null,
	"snapchat_user_profile" json DEFAULT null,
	"is_active" boolean DEFAULT true,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp DEFAULT null,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "platform_rate_limits" ADD CONSTRAINT "platform_rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_platform_idx" ON "platform_rate_limits" USING btree ("user_id","platform");--> statement-breakpoint
CREATE INDEX "window_end_idx" ON "platform_rate_limits" USING btree ("window_end");--> statement-breakpoint
CREATE INDEX "user_id_idx" ON "posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scheduled_time_idx" ON "posts" USING btree ("scheduled_time");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "post_status_idx" ON "posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platforms_idx" ON "posts" USING btree ("platforms");--> statement-breakpoint
CREATE INDEX "subscription_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_period_end_idx" ON "subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "is_active_idx" ON "users" USING btree ("is_active");