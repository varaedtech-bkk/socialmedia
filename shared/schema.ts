import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  json,
  index,
  uniqueIndex,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { MAX_POST_CONTENT_CHARS, validateInsertPostPlatformRules } from "./platform-limits";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
    email: text("email").notNull(),
    stripeCustomerId: text("stripe_customer_id").default(sql`null`),
    // Social media tokens
    facebookPageToken: text("facebook_page_token").default(sql`null`),
    facebookPersonalToken: text("facebook_personal_token").default(sql`null`),
    facebookPageId: text("facebook_page_id").default(sql`null`),
    instagramToken: text("instagram_token").default(sql`null`),
    linkedinToken: text("linkedin_token").default(sql`null`),
    linkedinPageToken: text("linkedin_page_token").default(sql`null`),
    linkedinUserProfile: json("linkedin_user_profile").default(sql`null`),
    linkedinPageUrn: text("linkedin_page_urn").default(sql`null`),
    instagramUserProfile: json("instagram_user_profile").default(sql`null`),
    instagramBusinessAccountId: text("instagram_business_account_id").default(sql`null`),
    twitterToken: text("twitter_token").default(sql`null`),
    twitterUserProfile: json("twitter_user_profile").default(sql`null`),
    youtubeToken: text("youtube_token").default(sql`null`),
    youtubeRefreshToken: text("youtube_refresh_token").default(sql`null`),
    youtubeChannelId: text("youtube_channel_id").default(sql`null`),
    youtubeUserProfile: json("youtube_user_profile").default(sql`null`),
    tiktokToken: text("tiktok_token").default(sql`null`),
    tiktokUserProfile: json("tiktok_user_profile").default(sql`null`),
    pinterestToken: text("pinterest_token").default(sql`null`),
    pinterestUserProfile: json("pinterest_user_profile").default(sql`null`),
    snapchatToken: text("snapchat_token").default(sql`null`),
    snapchatUserProfile: json("snapchat_user_profile").default(sql`null`),
    whatsappToken: text("whatsapp_token").default(sql`null`),
    whatsappBusinessAccountId: text("whatsapp_business_account_id").default(sql`null`),
    whatsappPhoneNumberId: text("whatsapp_phone_number_id").default(sql`null`),
    whatsappUserProfile: json("whatsapp_user_profile").default(sql`null`),
    /** When set, Telegram bot commands map to this user after /connect + web login */
    telegramChatId: text("telegram_chat_id").default(sql`null`),
    /** User's OpenRouter API key (BYOK); AI calls use this before optional platform OPENROUTER_API_KEY */
    openrouterApiKey: text("openrouter_api_key").default(sql`null`),
    /** Super admin must approve before login (invite / paid onboarding flow). */
    isApproved: boolean("is_approved").notNull().default(true),
    /** basic = dashboard/bot posting only; advance = AI drafts + OpenRouter bot features when a key exists */
    packageTier: text("package_tier").notNull().default("basic"),

    isActive: boolean("is_active").default(true),
    isDeleted: boolean("is_deleted").default(false),  // New soft delete field
    deletedAt: timestamp("deleted_at").default(sql`null`),  // New soft delete field
    role: text("role").notNull().default("client"), // 'client' | 'super_admin'
    permissions: json("permissions").$type<string[]>().default(sql`'[]'::json`), // Array of permission strings

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: index("username_idx").on(table.username),
    emailIdx: index("email_idx").on(table.email),
    isActiveIdx: index("is_active_idx").on(table.isActive),  // New index
  })
);

export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    packageTier: text("package_tier").notNull().default("basic"),
    /** Optional company-level OpenRouter key fallback for members. */
    openrouterApiKey: text("openrouter_api_key").default(sql`null`),
    ownerUserId: integer("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: index("companies_slug_idx").on(table.slug),
    ownerIdx: index("companies_owner_user_id_idx").on(table.ownerUserId),
  })
);

export const companyMemberships = pgTable(
  "company_memberships",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("moderator"), // owner | moderator
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    /** Per-member platform allowlist for connect/post checks. */
    allowedPlatforms: json("allowed_platforms").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    companyUserUniqueIdx: uniqueIndex("company_memberships_company_user_unique").on(table.companyId, table.userId),
    userIdx: index("company_memberships_user_idx").on(table.userId),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
    changedByUserId: integer("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: integer("target_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    oldValue: json("old_value").default(sql`null`),
    newValue: json("new_value").default(sql`null`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("audit_logs_company_created_idx").on(table.companyId, table.createdAt),
    targetIdx: index("audit_logs_target_user_idx").on(table.targetUserId),
  })
);

export const agentChannelUsers = pgTable(
  "agent_channel_users",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // telegram | whatsapp
    channelUserId: text("channel_user_id").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    channelIdentityUnique: uniqueIndex("agent_channel_users_channel_identity_unique").on(
      table.channel,
      table.channelUserId,
    ),
    companyUserChannelUnique: uniqueIndex("agent_channel_users_company_user_channel_unique").on(
      table.companyId,
      table.userId,
      table.channel,
    ),
    companyIdx: index("agent_channel_users_company_idx").on(table.companyId),
    userIdx: index("agent_channel_users_user_idx").on(table.userId),
  })
);

/** Prospective clients: purchase / interest → super admin notified → approve creates user */
export const accessRequests = pgTable(
  "access_requests",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull().default(""),
    company: text("company").default(sql`null`),
    message: text("message").default(sql`null`),
    deviceHash: text("device_hash").default(sql`null`),
    packageTierRequested: text("package_tier_requested").notNull().default("basic"),
    status: text("status").notNull().default("pending"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").default(sql`null`),
    stripeCustomerId: text("stripe_customer_id").default(sql`null`),
    stripeSubscriptionId: text("stripe_subscription_id").default(sql`null`),
    trialEndsAt: timestamp("trial_ends_at").default(sql`null`),
    paidAt: timestamp("paid_at").default(sql`null`),
    approvedUserId: integer("approved_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("access_requests_email_idx").on(table.email),
    statusIdx: index("access_requests_status_idx").on(table.status),
  })
);

/** Per-user connected social accounts (multiple Facebook pages, etc.) */
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    displayName: text("display_name").notNull().default(""),
    externalId: text("external_id").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").default(sql`null`),
    metadata: json("metadata").$type<Record<string, unknown>>().default(sql`'{}'::json`),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userPlatformIdx: index("social_accounts_user_platform_idx").on(table.userId, table.platform),
    userExternalIdx: index("social_accounts_user_external_idx").on(
      table.userId,
      table.platform,
      table.externalId
    ),
  })
);

export const subscriptionTiers = pgTable("subscription_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  monthlyPrice: integer("monthly_price").notNull(),
  yearlyPrice: integer("yearly_price").notNull(),
  postsLimit: integer("posts_limit").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),  // Added cascade delete
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    tierId: integer("tier_id")
      .notNull()
      .references(() => subscriptionTiers.id),
    status: text("status").notNull(), // 'active', 'canceled', 'past_due'
    currentPeriodStart: timestamp("current_period_start").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    postsUsed: integer("posts_used").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    canceledAt: timestamp("canceled_at").default(sql`null`),  // New field
  },
  (table) => ({
    userIdIdx: index("subscription_user_id_idx").on(table.userId),
    statusIdx: index("subscription_status_idx").on(table.status),  // New index
    periodEndIdx: index("subscription_period_end_idx").on(table.currentPeriodEnd),  // New index
  })
);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),  // Added cascade delete
    content: text("content").notNull(),
    scheduledTime: timestamp("scheduled_time").default(sql`null`),
    timezone: text("timezone").notNull().default("UTC"),
    status: text("status").notNull().default("draft"),
    platforms: json("platforms").$type<string[]>().notNull().default(["facebook-page"]),
    mediaUrls: json("media_urls").$type<string[]>().notNull().default([]),
    /** Optional per-platform caption; key = platform id. Empty/missing key uses `content`. */
    contentOverrides: json("content_overrides")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    mediaType: text("media_type").default(sql`null`),
    analytics: json("analytics").$type<{
      impressions?: number;
      clicks?: number;
      likes?: number;
      shares?: number;
      comments?: number;
      /** Graph API object ids after successful publish, used for remote delete */
      platformIds?: Record<string, string>;
    }>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    countedForQuota: boolean("counted_for_quota").default(false),  // Changed default
    isDeleted: boolean("is_deleted").default(false),  // New soft delete field
    deletedAt: timestamp("deleted_at").default(sql`null`),  // New soft delete field
  },
  (table) => ({
    userIdIdx: index("user_id_idx").on(table.userId),
    scheduledTimeIdx: index("scheduled_time_idx").on(table.scheduledTime),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
    statusIdx: index("post_status_idx").on(table.status),  // New index
    // Note: Cannot create btree index on JSON column, removed platformsIdx
  })
);

export const platformRateLimits = pgTable(
  "platform_rate_limits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),  // Added cascade delete
    platform: text("platform").notNull(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start").notNull().defaultNow(),
    windowEnd: timestamp("window_end").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userPlatformIdx: index("user_platform_idx").on(table.userId, table.platform),
    windowEndIdx: index("window_end_idx").on(table.windowEnd),  // New index
  })
);

// App settings table for feature flags and configuration
export const appSettings = pgTable(
  "app_settings",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    value: json("value").notNull(),
    description: text("description"),
    updatedBy: integer("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    keyIdx: index("app_settings_key_idx").on(table.key),
  })
);

// Enhanced enums with descriptions
export const subscriptionTierEnum = z.enum(["starter", "pro", "enterprise"])
  .describe("Subscription tier levels");
  
export const subscriptionStatusEnum = z.enum(["active", "canceled", "past_due", "trialing"])
  .describe("Subscription status values");

export const postStatusEnum = z.enum(["draft", "scheduled", "published", "failed"])
  .describe("Post status values");

// Platform enum for type safety with descriptions
// Note: facebook-personal removed as Facebook doesn't allow posting to personal profiles via API
export const platformEnum = z.enum([
  "facebook-page",
  "instagram",
  "linkedin",
  "linkedin-page",
  "twitter",
  "youtube",
  "tiktok",
  "pinterest",
  "snapchat",
  "whatsapp"
]).describe("Supported social media platforms");

// Enhanced user schema with validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
  facebookPageToken: z.string().optional(),
  facebookPersonalToken: z.string().optional(),
  // Add other token validations as needed
}).pick({
  username: true,
  password: true,
  email: true,
});

// Enhanced post schema with validation
export const insertPostSchema = createInsertSchema(posts, {
  content: z.string().min(1).max(MAX_POST_CONTENT_CHARS),
  platforms: z.array(platformEnum).min(1),
  mediaUrls: z.array(z.string().url()).max(10),
  mediaType: z.enum(["text", "image", "video", "pdf"]).default("text"),
  timezone: z.string().default("UTC"),
  status: postStatusEnum.default("draft"),
  analytics: z.object({
    impressions: z.number().int().nonnegative().optional().default(0),
    clicks: z.number().int().nonnegative().optional().default(0),
    likes: z.number().int().nonnegative().optional().default(0),
    shares: z.number().int().nonnegative().optional().default(0),
    comments: z.number().int().nonnegative().optional().default(0),
  }).default({}),
  contentOverrides: z.record(z.string(), z.string().max(MAX_POST_CONTENT_CHARS)).optional(),
}).pick({
  content: true,
  scheduledTime: true,
  platforms: true,
  mediaUrls: true,
  mediaType: true,
  timezone: true,
  status: true,
  analytics: true,
  countedForQuota: true,
  contentOverrides: true,
}).superRefine((data, ctx) => {
  const platforms = data.platforms as string[];
  if (data.contentOverrides) {
    for (const key of Object.keys(data.contentOverrides)) {
      const parsed = platformEnum.safeParse(key);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid platform in caption overrides",
          path: ["contentOverrides", key],
        });
        continue;
      }
      if (!platforms.includes(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Caption override platform must be included in post platforms",
          path: ["contentOverrides", key],
        });
      }
    }
  }

  for (const issue of validateInsertPostPlatformRules({
    content: data.content,
    platforms,
    contentOverrides: data.contentOverrides,
  })) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: issue.path as (string | number)[],
    });
  }
});

// Enhanced subscription schema
export const insertSubscriptionSchema = createInsertSchema(subscriptions, {
  status: subscriptionStatusEnum,
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date().refine(
    (date) => date > new Date(), 
    { message: "End date must be in the future" }
  ),
}).pick({
  userId: true,
  stripeSubscriptionId: true,
  tierId: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
});

// Platform rate limit schema
export const insertRateLimitSchema = createInsertSchema(platformRateLimits, {
  platform: platformEnum,
  count: z.number().int().nonnegative(),
  windowEnd: z.date().refine(
    (date) => date > new Date(),
    { message: "Window end must be in the future" }
  ),
}).pick({
  userId: true,
  platform: true,
  count: true,
  windowEnd: true,
});

// Export all types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;
export type Platform = z.infer<typeof platformEnum>;
export type PostStatus = z.infer<typeof postStatusEnum>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusEnum>;
export type RateLimit = typeof platformRateLimits.$inferSelect;
export type InsertRateLimit = z.infer<typeof insertRateLimitSchema>;
export type AppSetting = typeof appSettings.$inferSelect;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type AccessRequest = typeof accessRequests.$inferSelect;

export const packageTierEnum = z.enum(["basic", "advance"]);
export type PackageTier = z.infer<typeof packageTierEnum>;
export const companyRoleEnum = z.enum(["owner", "moderator"]);
export type CompanyRole = z.infer<typeof companyRoleEnum>;
export type Company = typeof companies.$inferSelect;
export type CompanyMembership = typeof companyMemberships.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AgentChannelUser = typeof agentChannelUsers.$inferSelect;