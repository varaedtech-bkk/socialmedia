import { pgTable, index, unique, serial, text, json, boolean, timestamp, foreignKey, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	email: text().notNull(),
	stripeCustomerId: text("stripe_customer_id"),
	facebookPageToken: text("facebook_page_token"),
	facebookPersonalToken: text("facebook_personal_token"),
	facebookPageId: text("facebook_page_id"),
	instagramToken: text("instagram_token"),
	linkedinToken: text("linkedin_token"),
	linkedinPageToken: text("linkedin_page_token"),
	linkedinUserProfile: json("linkedin_user_profile"),
	linkedinPageUrn: text("linkedin_page_urn"),
	instagramUserProfile: json("instagram_user_profile"),
	instagramBusinessAccountId: text("instagram_business_account_id"),
	twitterToken: text("twitter_token"),
	twitterUserProfile: json("twitter_user_profile"),
	youtubeToken: text("youtube_token"),
	youtubeUserProfile: json("youtube_user_profile"),
	tiktokToken: text("tiktok_token"),
	tiktokUserProfile: json("tiktok_user_profile"),
	pinterestToken: text("pinterest_token"),
	pinterestUserProfile: json("pinterest_user_profile"),
	snapchatToken: text("snapchat_token"),
	snapchatUserProfile: json("snapchat_user_profile"),
	isActive: boolean("is_active").default(true),
	isDeleted: boolean("is_deleted").default(false),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("username_idx").using("btree", table.username.asc().nullsLast().op("text_ops")),
	unique("users_username_unique").on(table.username),
]);

export const platformRateLimits = pgTable("platform_rate_limits", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	platform: text().notNull(),
	count: integer().default(0).notNull(),
	windowStart: timestamp("window_start", { mode: 'string' }).defaultNow().notNull(),
	windowEnd: timestamp("window_end", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_platform_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.platform.asc().nullsLast().op("int4_ops")),
	index("window_end_idx").using("btree", table.windowEnd.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "platform_rate_limits_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const posts = pgTable("posts", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	content: text().notNull(),
	scheduledTime: timestamp("scheduled_time", { mode: 'string' }),
	timezone: text().default('UTC').notNull(),
	status: text().default('draft').notNull(),
	platforms: json().default(["facebook-page"]).notNull(),
	mediaUrls: json("media_urls").default([]).notNull(),
	mediaType: text("media_type"),
	analytics: json().default({}).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	countedForQuota: boolean("counted_for_quota").default(false),
	isDeleted: boolean("is_deleted").default(false),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
}, (table) => [
	index("created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("post_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("scheduled_time_idx").using("btree", table.scheduledTime.asc().nullsLast().op("timestamp_ops")),
	index("user_id_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "posts_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const subscriptions = pgTable("subscriptions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	stripeSubscriptionId: text("stripe_subscription_id").notNull(),
	tierId: integer("tier_id").notNull(),
	status: text().notNull(),
	currentPeriodStart: timestamp("current_period_start", { mode: 'string' }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { mode: 'string' }).notNull(),
	postsUsed: integer("posts_used").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	canceledAt: timestamp("canceled_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "subscriptions_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tierId],
			foreignColumns: [subscriptionTiers.id],
			name: "subscriptions_tier_id_subscription_tiers_id_fk"
		}),
]);

export const subscriptionTiers = pgTable("subscription_tiers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	monthlyPrice: integer("monthly_price").notNull(),
	yearlyPrice: integer("yearly_price").notNull(),
	postsLimit: integer("posts_limit").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("subscription_tiers_name_unique").on(table.name),
]);
