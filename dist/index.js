var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  appSettings: () => appSettings,
  insertPostSchema: () => insertPostSchema,
  insertRateLimitSchema: () => insertRateLimitSchema,
  insertSubscriptionSchema: () => insertSubscriptionSchema,
  insertUserSchema: () => insertUserSchema,
  platformEnum: () => platformEnum,
  platformRateLimits: () => platformRateLimits,
  postStatusEnum: () => postStatusEnum,
  posts: () => posts,
  subscriptionStatusEnum: () => subscriptionStatusEnum,
  subscriptionTierEnum: () => subscriptionTierEnum,
  subscriptionTiers: () => subscriptionTiers,
  subscriptions: () => subscriptions,
  users: () => users
});
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  json,
  index,
  boolean
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users, subscriptionTiers, subscriptions, posts, platformRateLimits, appSettings, subscriptionTierEnum, subscriptionStatusEnum, postStatusEnum, platformEnum, insertUserSchema, insertPostSchema, insertSubscriptionSchema, insertRateLimitSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable(
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
        youtubeUserProfile: json("youtube_user_profile").default(sql`null`),
        tiktokToken: text("tiktok_token").default(sql`null`),
        tiktokUserProfile: json("tiktok_user_profile").default(sql`null`),
        pinterestToken: text("pinterest_token").default(sql`null`),
        pinterestUserProfile: json("pinterest_user_profile").default(sql`null`),
        snapchatToken: text("snapchat_token").default(sql`null`),
        snapchatUserProfile: json("snapchat_user_profile").default(sql`null`),
        isActive: boolean("is_active").default(true),
        isDeleted: boolean("is_deleted").default(false),
        // New soft delete field
        deletedAt: timestamp("deleted_at").default(sql`null`),
        // New soft delete field
        role: text("role").notNull().default("user"),
        // 'user', 'admin', 'super_admin'
        permissions: json("permissions").$type().default(sql`'[]'::json`),
        // Array of permission strings
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow()
      },
      (table) => ({
        usernameIdx: index("username_idx").on(table.username),
        emailIdx: index("email_idx").on(table.email),
        isActiveIdx: index("is_active_idx").on(table.isActive)
        // New index
      })
    );
    subscriptionTiers = pgTable("subscription_tiers", {
      id: serial("id").primaryKey(),
      name: text("name").notNull().unique(),
      description: text("description"),
      monthlyPrice: integer("monthly_price").notNull(),
      yearlyPrice: integer("yearly_price").notNull(),
      postsLimit: integer("posts_limit").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    subscriptions = pgTable(
      "subscriptions",
      {
        id: serial("id").primaryKey(),
        userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        // Added cascade delete
        stripeSubscriptionId: text("stripe_subscription_id").notNull(),
        tierId: integer("tier_id").notNull().references(() => subscriptionTiers.id),
        status: text("status").notNull(),
        // 'active', 'canceled', 'past_due'
        currentPeriodStart: timestamp("current_period_start").notNull(),
        currentPeriodEnd: timestamp("current_period_end").notNull(),
        postsUsed: integer("posts_used").default(0),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
        canceledAt: timestamp("canceled_at").default(sql`null`)
        // New field
      },
      (table) => ({
        userIdIdx: index("subscription_user_id_idx").on(table.userId),
        statusIdx: index("subscription_status_idx").on(table.status),
        // New index
        periodEndIdx: index("subscription_period_end_idx").on(table.currentPeriodEnd)
        // New index
      })
    );
    posts = pgTable(
      "posts",
      {
        id: serial("id").primaryKey(),
        userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        // Added cascade delete
        content: text("content").notNull(),
        scheduledTime: timestamp("scheduled_time").default(sql`null`),
        timezone: text("timezone").notNull().default("UTC"),
        status: text("status").notNull().default("draft"),
        platforms: json("platforms").$type().notNull().default(["facebook-page"]),
        mediaUrls: json("media_urls").$type().notNull().default([]),
        mediaType: text("media_type").default(sql`null`),
        analytics: json("analytics").$type().notNull().default({}),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
        countedForQuota: boolean("counted_for_quota").default(false),
        // Changed default
        isDeleted: boolean("is_deleted").default(false),
        // New soft delete field
        deletedAt: timestamp("deleted_at").default(sql`null`)
        // New soft delete field
      },
      (table) => ({
        userIdIdx: index("user_id_idx").on(table.userId),
        scheduledTimeIdx: index("scheduled_time_idx").on(table.scheduledTime),
        createdAtIdx: index("created_at_idx").on(table.createdAt),
        statusIdx: index("post_status_idx").on(table.status)
        // New index
        // Note: Cannot create btree index on JSON column, removed platformsIdx
      })
    );
    platformRateLimits = pgTable(
      "platform_rate_limits",
      {
        id: serial("id").primaryKey(),
        userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        // Added cascade delete
        platform: text("platform").notNull(),
        count: integer("count").notNull().default(0),
        windowStart: timestamp("window_start").notNull().defaultNow(),
        windowEnd: timestamp("window_end").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow()
      },
      (table) => ({
        userPlatformIdx: index("user_platform_idx").on(table.userId, table.platform),
        windowEndIdx: index("window_end_idx").on(table.windowEnd)
        // New index
      })
    );
    appSettings = pgTable(
      "app_settings",
      {
        id: serial("id").primaryKey(),
        key: text("key").notNull().unique(),
        value: json("value").notNull(),
        description: text("description"),
        updatedBy: integer("updated_by").references(() => users.id),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
        createdAt: timestamp("created_at").notNull().defaultNow()
      },
      (table) => ({
        keyIdx: index("app_settings_key_idx").on(table.key)
      })
    );
    subscriptionTierEnum = z.enum(["starter", "pro", "enterprise"]).describe("Subscription tier levels");
    subscriptionStatusEnum = z.enum(["active", "canceled", "past_due", "trialing"]).describe("Subscription status values");
    postStatusEnum = z.enum(["draft", "scheduled", "published", "failed"]).describe("Post status values");
    platformEnum = z.enum([
      "facebook-personal",
      "facebook-page",
      "instagram",
      "linkedin",
      "linkedin-page",
      "twitter",
      "youtube",
      "tiktok",
      "pinterest",
      "snapchat"
    ]).describe("Supported social media platforms");
    insertUserSchema = createInsertSchema(users, {
      email: z.string().email(),
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
      password: z.string().min(8),
      facebookPageToken: z.string().optional(),
      facebookPersonalToken: z.string().optional()
      // Add other token validations as needed
    }).pick({
      username: true,
      password: true,
      email: true
    });
    insertPostSchema = createInsertSchema(posts, {
      content: z.string().min(1).max(5e3),
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
        comments: z.number().int().nonnegative().optional().default(0)
      }).default({})
    }).pick({
      content: true,
      scheduledTime: true,
      platforms: true,
      mediaUrls: true,
      mediaType: true,
      timezone: true,
      status: true,
      analytics: true,
      countedForQuota: true
    });
    insertSubscriptionSchema = createInsertSchema(subscriptions, {
      status: subscriptionStatusEnum,
      currentPeriodStart: z.date(),
      currentPeriodEnd: z.date().refine(
        (date2) => date2 > /* @__PURE__ */ new Date(),
        { message: "End date must be in the future" }
      )
    }).pick({
      userId: true,
      stripeSubscriptionId: true,
      tierId: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true
    });
    insertRateLimitSchema = createInsertSchema(platformRateLimits, {
      platform: platformEnum,
      count: z.number().int().nonnegative(),
      windowEnd: z.date().refine(
        (date2) => date2 > /* @__PURE__ */ new Date(),
        { message: "Window end must be in the future" }
      )
    }).pick({
      userId: true,
      platform: true,
      count: true,
      windowEnd: true
    });
  }
});

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import dotenv from "dotenv";
var Pool, pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    ({ Pool } = pkg);
    dotenv.config();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Connection pool settings
      max: 20,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 2e3
    });
    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// server/db-storage.ts
import { eq, and, desc, sql as sql2, gte, lte } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
import dotenv2 from "dotenv";
var MemoryStore, sessionStore, DbStorage;
var init_db_storage = __esm({
  "server/db-storage.ts"() {
    "use strict";
    init_db();
    dotenv2.config();
    MemoryStore = createMemoryStore(session);
    try {
      const connectPgSimple = __require("connect-pg-simple")(session);
      const { Pool: Pool2 } = __require("pg");
      if (process.env.DATABASE_URL) {
        try {
          const pool2 = new Pool2({ connectionString: process.env.DATABASE_URL });
          sessionStore = new connectPgSimple({
            pool: pool2,
            tableName: "session"
          });
          console.log("\u2705 Using PostgreSQL session store");
        } catch (error) {
          console.warn("\u26A0\uFE0F  Failed to initialize PostgreSQL session store, using memory store:", error);
          sessionStore = new MemoryStore({
            checkPeriod: 864e5
            // 1 day
          });
        }
      } else {
        sessionStore = new MemoryStore({
          checkPeriod: 864e5
          // 1 day
        });
      }
    } catch (error) {
      console.warn("\u26A0\uFE0F  Using memory session store (install 'pg' package for PostgreSQL sessions)");
      sessionStore = new MemoryStore({
        checkPeriod: 864e5
        // 1 day
      });
    }
    DbStorage = class {
      sessionStore = sessionStore;
      // Subscription methods
      async getSubscriptionByStripeId(stripeSubscriptionId) {
        const result = await db.select().from(schema_exports.subscriptions).where(eq(schema_exports.subscriptions.stripeSubscriptionId, stripeSubscriptionId)).limit(1);
        if (result.length === 0) return null;
        const sub = result[0];
        return {
          id: sub.id,
          userId: sub.userId,
          plan: sub.tierId.toString(),
          // Convert tierId to plan string
          status: sub.status,
          postsUsed: sub.postsUsed || 0,
          postsLimit: 0,
          // Will need to join with subscription_tiers
          periodStart: sub.currentPeriodStart.getTime(),
          periodEnd: sub.currentPeriodEnd.getTime(),
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripeCustomerId: "",
          // Will need to get from user
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt
        };
      }
      async getUserSubscription(userId) {
        const result = await db.select({
          subscription: schema_exports.subscriptions,
          tier: schema_exports.subscriptionTiers,
          user: schema_exports.users
        }).from(schema_exports.subscriptions).innerJoin(schema_exports.subscriptionTiers, eq(schema_exports.subscriptions.tierId, schema_exports.subscriptionTiers.id)).innerJoin(schema_exports.users, eq(schema_exports.subscriptions.userId, schema_exports.users.id)).where(eq(schema_exports.subscriptions.userId, userId)).orderBy(desc(schema_exports.subscriptions.createdAt)).limit(1);
        if (result.length === 0) return null;
        const { subscription: sub, tier, user } = result[0];
        return {
          id: sub.id,
          userId: sub.userId,
          plan: tier.name,
          status: sub.status,
          postsUsed: sub.postsUsed || 0,
          postsLimit: tier.postsLimit,
          periodStart: sub.currentPeriodStart.getTime(),
          periodEnd: sub.currentPeriodEnd.getTime(),
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripeCustomerId: user.stripeCustomerId || "",
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt
        };
      }
      async createSubscription(subscription) {
        const tierResult = await db.select().from(schema_exports.subscriptionTiers).where(eq(schema_exports.subscriptionTiers.name, subscription.plan)).limit(1);
        if (tierResult.length === 0) {
          throw new Error(`Subscription tier "${subscription.plan}" not found`);
        }
        const tierId = tierResult[0].id;
        const periodStart = new Date(subscription.periodStart * 1e3);
        const periodEnd = new Date(subscription.periodEnd * 1e3);
        const result = await db.insert(schema_exports.subscriptions).values({
          userId: subscription.userId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          tierId,
          status: subscription.status,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          postsUsed: subscription.postsUsed || 0
        }).returning();
        const sub = result[0];
        return {
          id: sub.id,
          userId: sub.userId,
          plan: subscription.plan,
          status: sub.status,
          postsUsed: sub.postsUsed || 0,
          postsLimit: tierResult[0].postsLimit,
          periodStart: sub.currentPeriodStart.getTime(),
          periodEnd: sub.currentPeriodEnd.getTime(),
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripeCustomerId: "",
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt
        };
      }
      async updateSubscription(subscriptionId, updates) {
        const updateData = {};
        if (updates.status) updateData.status = updates.status;
        if (updates.postsUsed !== void 0) updateData.postsUsed = updates.postsUsed;
        if (updates.periodEnd !== void 0) {
          updateData.currentPeriodEnd = new Date(updates.periodEnd);
        }
        if (updates.periodStart !== void 0) {
          updateData.currentPeriodStart = new Date(updates.periodStart);
        }
        updateData.updatedAt = /* @__PURE__ */ new Date();
        const result = await db.update(schema_exports.subscriptions).set(updateData).where(eq(schema_exports.subscriptions.id, subscriptionId)).returning();
        if (result.length === 0) {
          throw new Error("Subscription not found");
        }
        const sub = result[0];
        const tierResult = await db.select().from(schema_exports.subscriptionTiers).where(eq(schema_exports.subscriptionTiers.id, sub.tierId)).limit(1);
        return {
          id: sub.id,
          userId: sub.userId,
          plan: tierResult[0]?.name || "",
          status: sub.status,
          postsUsed: sub.postsUsed || 0,
          postsLimit: tierResult[0]?.postsLimit || 0,
          periodStart: sub.currentPeriodStart.getTime(),
          periodEnd: sub.currentPeriodEnd.getTime(),
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripeCustomerId: "",
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt
        };
      }
      // User methods
      async getUser(id) {
        const result = await db.select().from(schema_exports.users).where(and(eq(schema_exports.users.id, id), eq(schema_exports.users.isDeleted, false))).limit(1);
        return result[0];
      }
      async getUserByUsername(username) {
        const result = await db.select().from(schema_exports.users).where(and(eq(schema_exports.users.username, username), eq(schema_exports.users.isDeleted, false))).limit(1);
        return result[0];
      }
      async createUser(insertUser) {
        const result = await db.insert(schema_exports.users).values(insertUser).returning();
        return result[0];
      }
      async updateUserFacebookPersonalToken(userId, token) {
        const result = await db.update(schema_exports.users).set({ facebookPersonalToken: token, updatedAt: /* @__PURE__ */ new Date() }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async updateUserFacebookPageToken(userId, token, pageId) {
        const result = await db.update(schema_exports.users).set({
          facebookPageToken: token,
          facebookPageId: pageId,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async updateUserInstagramToken(userId, token, userProfile) {
        const result = await db.update(schema_exports.users).set({
          instagramToken: token,
          instagramUserProfile: userProfile,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async updateUserLinkedInToken(userId, token, userProfile) {
        const result = await db.update(schema_exports.users).set({
          linkedinToken: token,
          linkedinUserProfile: userProfile,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async updateUserLinkedInPageToken(userId, token, pageUrn) {
        const result = await db.update(schema_exports.users).set({
          linkedinPageToken: token,
          linkedinPageUrn: pageUrn,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async updateUserTwitterToken(userId, token, userProfile) {
        const result = await db.update(schema_exports.users).set({
          twitterToken: token,
          twitterUserProfile: userProfile,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async updateUserYouTubeToken(userId, token, userProfile) {
        const result = await db.update(schema_exports.users).set({
          youtubeToken: token,
          youtubeUserProfile: userProfile,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async updateUserTikTokToken(userId, token, userProfile) {
        const result = await db.update(schema_exports.users).set({
          tiktokToken: token,
          tiktokUserProfile: userProfile,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async updateUserPinterestToken(userId, token, userProfile) {
        const result = await db.update(schema_exports.users).set({
          pinterestToken: token,
          pinterestUserProfile: userProfile,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async updateUserSnapchatToken(userId, token, userProfile) {
        const result = await db.update(schema_exports.users).set({
          snapchatToken: token,
          snapchatUserProfile: userProfile,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      async getAllUsers() {
        return await db.select().from(schema_exports.users).where(eq(schema_exports.users.isDeleted, false));
      }
      async deleteUser(userId) {
        const result = await db.update(schema_exports.users).set({
          isDeleted: true,
          deletedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.users.id, userId)).returning();
        if (result.length === 0) throw new Error("User not found");
        return result[0];
      }
      // Post methods
      async createPost(userId, insertPost) {
        const result = await db.insert(schema_exports.posts).values({
          ...insertPost,
          userId,
          status: insertPost.status || (insertPost.scheduledTime ? "scheduled" : "draft")
        }).returning();
        return result[0];
      }
      async getUserPosts(userId, page = 1, limit = 10, status) {
        const conditions = [
          eq(schema_exports.posts.userId, userId),
          eq(schema_exports.posts.isDeleted, false)
        ];
        if (status) {
          conditions.push(eq(schema_exports.posts.status, status));
        }
        return await db.select().from(schema_exports.posts).where(and(...conditions)).orderBy(desc(schema_exports.posts.createdAt)).limit(limit).offset((page - 1) * limit);
      }
      async updatePost(postId, updates) {
        const updateData = { ...updates, updatedAt: /* @__PURE__ */ new Date() };
        const result = await db.update(schema_exports.posts).set(updateData).where(eq(schema_exports.posts.id, postId)).returning();
        if (result.length === 0) throw new Error("Post not found");
        return result[0];
      }
      async getScheduledPosts(userId) {
        return await db.select().from(schema_exports.posts).where(
          and(
            eq(schema_exports.posts.userId, userId),
            eq(schema_exports.posts.status, "scheduled"),
            eq(schema_exports.posts.isDeleted, false)
          )
        );
      }
      async updatePostStatus(postId, status) {
        const result = await db.update(schema_exports.posts).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq(schema_exports.posts.id, postId)).returning();
        if (result.length === 0) throw new Error("Post not found");
        return result[0];
      }
      async updatePostAnalytics(postId, analytics) {
        const result = await db.update(schema_exports.posts).set({ analytics, updatedAt: /* @__PURE__ */ new Date() }).where(eq(schema_exports.posts.id, postId)).returning();
        if (result.length === 0) throw new Error("Post not found");
        return result[0];
      }
      async deletePost(postId) {
        const result = await db.update(schema_exports.posts).set({
          isDeleted: true,
          deletedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(schema_exports.posts.id, postId)).returning();
        if (result.length === 0) throw new Error("Post not found");
        return result[0];
      }
      async getPost(postId) {
        const result = await db.select().from(schema_exports.posts).where(and(eq(schema_exports.posts.id, postId), eq(schema_exports.posts.isDeleted, false))).limit(1);
        return result[0];
      }
      async getAllPosts() {
        return await db.select().from(schema_exports.posts).where(eq(schema_exports.posts.isDeleted, false)).orderBy(desc(schema_exports.posts.createdAt));
      }
      async clearAllPosts() {
        await db.delete(schema_exports.posts);
      }
      // Quota and payment methods
      async getUserPostCount(userId, month) {
        const startOfMonth = new Date((/* @__PURE__ */ new Date()).getFullYear(), month, 1);
        const endOfMonth = new Date((/* @__PURE__ */ new Date()).getFullYear(), month + 1, 0, 23, 59, 59);
        const result = await db.select({ count: sql2`count(*)` }).from(schema_exports.posts).where(
          and(
            eq(schema_exports.posts.userId, userId),
            eq(schema_exports.posts.countedForQuota, true),
            eq(schema_exports.posts.isDeleted, false),
            gte(schema_exports.posts.createdAt, startOfMonth),
            lte(schema_exports.posts.createdAt, endOfMonth)
          )
        );
        return Number(result[0]?.count || 0);
      }
      async getUserPlatformPostsLastHour(userId, platform) {
        const now = /* @__PURE__ */ new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1e3);
        const result = await db.select({ count: sql2`count(*)` }).from(schema_exports.posts).where(
          and(
            eq(schema_exports.posts.userId, userId),
            eq(schema_exports.posts.isDeleted, false),
            gte(schema_exports.posts.createdAt, oneHourAgo),
            lte(schema_exports.posts.createdAt, now),
            sql2`${schema_exports.posts.platforms}::jsonb @> ${JSON.stringify([platform])}::jsonb`
          )
        );
        return Number(result[0]?.count || 0);
      }
      async updateUserStripeId(userId, stripeId) {
        await db.update(schema_exports.users).set({ stripeCustomerId: stripeId, updatedAt: /* @__PURE__ */ new Date() }).where(eq(schema_exports.users.id, userId));
      }
      async getUserPackage(userId) {
        const subscription = await this.getUserSubscription(userId);
        return subscription ? { tier: subscription.plan } : null;
      }
      async updateUserSubscription(userId, tier, postsUsed, periodEnd) {
        const existingSub = await this.getUserSubscription(userId);
        if (existingSub) {
          await this.updateSubscription(existingSub.id, {
            postsUsed,
            periodEnd: periodEnd.getTime()
          });
        } else {
          const tierResult = await db.select().from(schema_exports.subscriptionTiers).where(eq(schema_exports.subscriptionTiers.name, tier)).limit(1);
          if (tierResult.length === 0) {
            throw new Error(`Tier "${tier}" not found`);
          }
          await db.insert(schema_exports.subscriptions).values({
            userId,
            tierId: tierResult[0].id,
            stripeSubscriptionId: `temp_${userId}_${Date.now()}`,
            status: "active",
            currentPeriodStart: /* @__PURE__ */ new Date(),
            currentPeriodEnd: periodEnd,
            postsUsed
          });
        }
      }
    };
  }
});

// server/storage.ts
import session2 from "express-session";
import createMemoryStore2 from "memorystore";
function initializeStorage() {
  if (process.env.DATABASE_URL) {
    try {
      const dbStorage = new DbStorage();
      console.log("\u2705 Using database storage");
      return dbStorage;
    } catch (error) {
      console.error("\u274C Failed to initialize database storage, falling back to memory:", error);
      return new MemStorage();
    }
  } else {
    console.warn("\u26A0\uFE0F  DATABASE_URL not set, using in-memory storage (data will be lost on restart)");
    return new MemStorage();
  }
}
var MemoryStore2, MemStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_db_storage();
    MemoryStore2 = createMemoryStore2(session2);
    MemStorage = class {
      users;
      posts;
      currentUserId;
      currentPostId;
      subscriptions;
      subscriptionIdCounter;
      postCounts;
      sessionStore;
      constructor() {
        this.users = /* @__PURE__ */ new Map();
        this.posts = /* @__PURE__ */ new Map();
        this.subscriptions = /* @__PURE__ */ new Map();
        this.subscriptionIdCounter = 1;
        this.postCounts = /* @__PURE__ */ new Map();
        this.currentUserId = 1;
        this.currentPostId = 1;
        this.sessionStore = new MemoryStore2({
          checkPeriod: 864e5
          // 1 day
        });
      }
      // Helper method to validate user existence
      async validateUser(userId) {
        const user = this.users.get(userId);
        if (!user) {
          throw new Error(`User with ID ${userId} not found`);
        }
        return user;
      }
      // Helper method to validate post existence
      async validatePost(postId) {
        const post = this.posts.get(postId);
        if (!post) {
          throw new Error(`Post with ID ${postId} not found`);
        }
        return post;
      }
      // Subscription methods
      async getSubscriptionByStripeId(stripeSubscriptionId) {
        for (const sub of Array.from(this.subscriptions.values())) {
          if (sub.stripeSubscriptionId === stripeSubscriptionId) {
            return sub;
          }
        }
        return null;
      }
      async getUserSubscription(userId) {
        for (const sub of Array.from(this.subscriptions.values())) {
          if (sub.userId === userId) {
            return sub;
          }
        }
        return null;
      }
      async createSubscription(subscription) {
        const id = this.subscriptionIdCounter++;
        const newSubscription = {
          ...subscription,
          id,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        };
        this.subscriptions.set(id, newSubscription);
        return newSubscription;
      }
      async updateSubscription(subscriptionId, updates) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
          throw new Error("Subscription not found");
        }
        const updated = { ...subscription, ...updates, updatedAt: /* @__PURE__ */ new Date() };
        this.subscriptions.set(subscriptionId, updated);
        return updated;
      }
      // User methods
      async getUser(id) {
        return this.users.get(id);
      }
      async getUserByUsername(username) {
        return Array.from(this.users.values()).find(
          (user) => user.username === username
        );
      }
      async createUser(insertUser) {
        const now = /* @__PURE__ */ new Date();
        const id = this.currentUserId++;
        const user = {
          ...insertUser,
          id,
          facebookPersonalToken: null,
          facebookPageToken: null,
          facebookPageId: null,
          linkedinToken: null,
          linkedinPageToken: null,
          linkedinUserProfile: null,
          linkedinPageUrn: null,
          instagramToken: null,
          instagramUserProfile: null,
          instagramBusinessAccountId: null,
          twitterToken: null,
          twitterUserProfile: null,
          youtubeToken: null,
          youtubeUserProfile: null,
          tiktokToken: null,
          tiktokUserProfile: null,
          pinterestToken: null,
          pinterestUserProfile: null,
          snapchatToken: null,
          snapchatUserProfile: null,
          stripeCustomerId: null,
          isActive: true,
          isDeleted: false,
          deletedAt: null,
          role: insertUser.role || "user",
          permissions: insertUser.permissions || [],
          createdAt: now,
          updatedAt: now
        };
        this.users.set(id, user);
        return user;
      }
      async updateUserFacebookPersonalToken(userId, token) {
        const user = await this.validateUser(userId);
        const updatedUser = { ...user, facebookPersonalToken: token };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async updateUserFacebookPageToken(userId, token, pageId) {
        const user = await this.validateUser(userId);
        const updatedUser = {
          ...user,
          facebookPageToken: token,
          facebookPageId: pageId
        };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async updateUserInstagramToken(userId, token, instagramBusinessAccountId) {
        const user = await this.validateUser(userId);
        const updatedUser = {
          ...user,
          instagramToken: token,
          instagramBusinessAccountId
        };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async updateUserLinkedInToken(userId, token, userProfile) {
        const user = await this.validateUser(userId);
        const updatedUser = {
          ...user,
          linkedinToken: token,
          linkedinUserProfile: userProfile
        };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async updateUserLinkedInPageToken(userId, token, pageUrn) {
        const user = await this.validateUser(userId);
        const updatedUser = {
          ...user,
          linkedinPageToken: token,
          linkedinPageUrn: pageUrn
        };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async updateUserTwitterToken(userId, token, userProfile) {
        const user = await this.validateUser(userId);
        const updatedUser = {
          ...user,
          twitterToken: token,
          twitterUserProfile: userProfile
        };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async updateUserYouTubeToken(userId, token, userProfile) {
        const user = await this.validateUser(userId);
        const updatedUser = {
          ...user,
          youtubeToken: token,
          youtubeUserProfile: userProfile
        };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async updateUserTikTokToken(userId, token, userProfile) {
        const user = await this.validateUser(userId);
        const updatedUser = {
          ...user,
          tiktokToken: token,
          tiktokUserProfile: userProfile
        };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async updateUserPinterestToken(userId, token, userProfile) {
        const user = await this.validateUser(userId);
        const updatedUser = {
          ...user,
          pinterestToken: token,
          pinterestUserProfile: userProfile
        };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async updateUserSnapchatToken(userId, token, userProfile) {
        const user = await this.validateUser(userId);
        const updatedUser = {
          ...user,
          snapchatToken: token,
          snapchatUserProfile: userProfile
        };
        this.users.set(userId, updatedUser);
        return updatedUser;
      }
      async getAllUsers() {
        return Array.from(this.users.values());
      }
      async deleteUser(userId) {
        const user = await this.validateUser(userId);
        this.users.delete(userId);
        return user;
      }
      // Post methods
      async createPost(userId, insertPost) {
        const id = this.currentPostId++;
        const post = {
          ...insertPost,
          id,
          userId,
          status: insertPost.status || (insertPost.scheduledTime ? "scheduled" : "draft"),
          analytics: insertPost.analytics || {},
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date(),
          timezone: insertPost.timezone || "UTC",
          scheduledTime: insertPost.scheduledTime ?? null,
          platforms: insertPost.platforms ?? [],
          mediaUrls: insertPost.mediaUrls ?? [],
          mediaType: insertPost.mediaType ?? null,
          countedForQuota: insertPost.countedForQuota ?? false,
          isDeleted: false,
          // Initialize soft delete fields
          deletedAt: null
          // Initialize soft delete fields
        };
        this.posts.set(id, post);
        return post;
      }
      async getUserPosts(userId, page = 1, limit = 10, status) {
        let allPosts = Array.from(this.posts.values()).filter(
          (post) => post.userId === userId
        );
        if (status) {
          allPosts = allPosts.filter((post) => post.status === status);
        }
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        return allPosts.slice(startIndex, endIndex);
      }
      async updatePost(postId, updates) {
        const post = await this.validatePost(postId);
        const updatedPost = {
          ...post,
          ...updates,
          updatedAt: /* @__PURE__ */ new Date()
        };
        this.posts.set(postId, updatedPost);
        return updatedPost;
      }
      async countPostForQuota(postId) {
        const post = await this.getPost(postId);
        if (post && !post.countedForQuota) {
          await this.updatePost(postId, { countedForQuota: true });
        }
      }
      async getScheduledPosts(userId) {
        return Array.from(this.posts.values()).filter(
          (post) => post.userId === userId && post.status === "scheduled"
        );
      }
      async updatePostStatus(postId, status) {
        const post = await this.validatePost(postId);
        const updatedPost = { ...post, status, updatedAt: /* @__PURE__ */ new Date() };
        this.posts.set(postId, updatedPost);
        return updatedPost;
      }
      async updatePostAnalytics(postId, analytics) {
        const post = await this.validatePost(postId);
        const updatedPost = { ...post, analytics, updatedAt: /* @__PURE__ */ new Date() };
        this.posts.set(postId, updatedPost);
        return updatedPost;
      }
      async deletePost(postId) {
        const post = await this.validatePost(postId);
        this.posts.delete(postId);
        return post;
      }
      async getPost(postId) {
        try {
          return await this.validatePost(postId);
        } catch {
          return void 0;
        }
      }
      async getAllPosts() {
        return Array.from(this.posts.values());
      }
      async clearAllPosts() {
        this.posts.clear();
      }
      // Quota and payment methods
      async getUserPostCount(userId, month) {
        return Array.from(this.posts.values()).filter((post) => {
          if (post.userId !== userId) return false;
          const postMonth = post.createdAt?.getMonth() || (/* @__PURE__ */ new Date()).getMonth();
          return postMonth === month;
        }).length;
      }
      async getUserPlatformPostsLastHour(userId, platform) {
        const now = /* @__PURE__ */ new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1e3);
        return Array.from(this.posts.values()).filter((post) => {
          if (post.userId !== userId) return false;
          const validPlatforms = [
            "facebook-personal",
            "facebook-page",
            "instagram",
            "linkedin",
            "linkedin-page",
            "twitter",
            "youtube",
            "tiktok",
            "pinterest",
            "snapchat"
          ];
          const postPlatforms = Array.isArray(post.platforms) ? post.platforms.filter((p) => validPlatforms.includes(p)) : [];
          if (!postPlatforms.includes(platform)) return false;
          const postTime = post.createdAt || /* @__PURE__ */ new Date();
          return postTime >= oneHourAgo && postTime <= now;
        }).length;
      }
      async updateUserStripeId(userId, stripeId) {
        const user = await this.validateUser(userId);
        this.users.set(userId, { ...user, stripeCustomerId: stripeId });
      }
      async getUserPackage(userId) {
        const subscription = await this.getUserSubscription(userId);
        return subscription ? { tier: subscription.plan } : null;
      }
      // Additional helper method for subscription management
      async updateUserSubscription(userId, tier, postsUsed, periodEnd) {
        const existingSub = await this.getUserSubscription(userId);
        if (existingSub) {
          await this.updateSubscription(existingSub.id, {
            plan: tier,
            postsUsed,
            periodEnd: Math.floor(periodEnd.getTime() / 1e3)
          });
        } else {
          await this.createSubscription({
            userId,
            plan: tier,
            status: "active",
            postsUsed,
            postsLimit: 0,
            // Set appropriate limit
            periodStart: Math.floor(Date.now() / 1e3),
            periodEnd: Math.floor(periodEnd.getTime() / 1e3),
            stripeSubscriptionId: "",
            stripeCustomerId: "",
            createdAt: /* @__PURE__ */ new Date(),
            updatedAt: /* @__PURE__ */ new Date()
          });
        }
      }
    };
    storage = initializeStorage();
  }
});

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session3 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import dotenv3 from "dotenv";
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET ?? "dev-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore
  };
  app2.set("trust proxy", 1);
  app2.use(session3(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password"
      },
      async (username, password, done) => {
        try {
          console.log(`[AUTH] Login attempt for username: "${username}"`);
          const user = await storage.getUserByUsername(username);
          if (!user) {
            console.log(`[AUTH] \u274C User "${username}" not found`);
            return done(null, false, { message: "Invalid username or password" });
          }
          console.log(`[AUTH] \u2705 User found: ${user.username} (ID: ${user.id})`);
          const passwordMatch = await comparePasswords(password, user.password);
          if (!passwordMatch) {
            console.log(`[AUTH] \u274C Invalid password for user "${username}"`);
            return done(null, false, { message: "Invalid username or password" });
          }
          console.log(`[AUTH] \u2705\u2705\u2705 Login successful for user "${username}"`);
          return done(null, user);
        } catch (error) {
          console.error("[AUTH] \u274C Login error:", error);
          return done(error);
        }
      }
    )
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });
  app2.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }
    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password)
    });
    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });
  app2.post("/api/login", (req, res, next) => {
    console.log(`[LOGIN API] Received login request:`, {
      username: req.body?.username,
      hasPassword: !!req.body?.password,
      bodyKeys: Object.keys(req.body || {})
    });
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("[LOGIN API] \u274C Authentication error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      if (!user) {
        console.log(`[LOGIN API] \u274C Authentication failed:`, info?.message);
        return res.status(401).json({
          error: info?.message || "Invalid username or password"
        });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("[LOGIN API] \u274C Session creation error:", loginErr);
          return res.status(500).json({ error: "Failed to establish session" });
        }
        console.log(`[LOGIN API] \u2705\u2705\u2705 Login successful, session created for: ${user.username}`);
        const { password: _, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
}
var scryptAsync;
var init_auth = __esm({
  "server/auth.ts"() {
    "use strict";
    init_storage();
    dotenv3.config();
    scryptAsync = promisify(scrypt);
  }
});

// server/feature-config.ts
import { eq as eq2 } from "drizzle-orm";
async function initializeFeatureFlags() {
  try {
    for (const [key, defaultValue] of Object.entries(DEFAULT_FEATURES)) {
      const existing = await db.select().from(schema_exports.appSettings).where(eq2(schema_exports.appSettings.key, key)).limit(1);
      if (existing.length === 0) {
        await db.insert(schema_exports.appSettings).values({
          key,
          value: defaultValue,
          description: getFeatureDescription(key)
        });
        featureCache.set(key, defaultValue);
      } else {
        const value = existing[0].value;
        featureCache.set(key, value);
      }
    }
    console.log("\u2705 Feature flags initialized");
  } catch (error) {
    console.error("\u26A0\uFE0F  Failed to initialize feature flags:", error);
    Object.entries(DEFAULT_FEATURES).forEach(([key, value]) => {
      featureCache.set(key, value);
    });
  }
}
function getFeatureDescription(key) {
  const descriptions = {
    [FEATURE_KEYS.SUBSCRIPTIONS_ENABLED]: "Enable/disable subscription plans and tier management",
    [FEATURE_KEYS.POST_QUOTA_ENABLED]: "Enable/disable post quota limits based on subscription tiers",
    [FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED]: "Enable/disable Stripe payment processing"
  };
  return descriptions[key] || "Feature flag";
}
function isFeatureEnabled(key) {
  if (featureCache.has(key)) {
    return featureCache.get(key) ?? false;
  }
  const defaultValue = DEFAULT_FEATURES[key];
  return defaultValue ?? false;
}
async function updateFeatureFlag(key, value, updatedBy) {
  try {
    const existing = await db.select().from(schema_exports.appSettings).where(eq2(schema_exports.appSettings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(schema_exports.appSettings).set({
        value,
        updatedBy: updatedBy || null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(schema_exports.appSettings.key, key));
    } else {
      await db.insert(schema_exports.appSettings).values({
        key,
        value,
        description: getFeatureDescription(key),
        updatedBy: updatedBy || null
      });
    }
    featureCache.set(key, value);
    console.log(`\u2705 Feature flag ${key} updated to ${value}`);
  } catch (error) {
    console.error(`Error updating feature flag ${key}:`, error);
    throw error;
  }
}
async function getAllFeatureFlags() {
  try {
    const allSettings = await db.select().from(schema_exports.appSettings);
    const featureFlags = allSettings.filter((setting) => Object.values(FEATURE_KEYS).includes(setting.key)).map((setting) => ({
      key: setting.key,
      value: setting.value,
      description: setting.description,
      updatedAt: setting.updatedAt
    }));
    const existingKeys = new Set(featureFlags.map((f) => f.key));
    const missingFlags = Object.entries(DEFAULT_FEATURES).filter(([key]) => !existingKeys.has(key)).map(([key, value]) => ({
      key,
      value,
      description: getFeatureDescription(key),
      updatedAt: /* @__PURE__ */ new Date()
    }));
    return [...featureFlags, ...missingFlags];
  } catch (error) {
    console.error("Error fetching all feature flags:", error);
    return Object.entries(DEFAULT_FEATURES).map(([key, value]) => ({
      key,
      value,
      description: getFeatureDescription(key),
      updatedAt: /* @__PURE__ */ new Date()
    }));
  }
}
var FEATURE_KEYS, DEFAULT_FEATURES, featureCache;
var init_feature_config = __esm({
  "server/feature-config.ts"() {
    "use strict";
    init_db();
    FEATURE_KEYS = {
      SUBSCRIPTIONS_ENABLED: "subscriptions_enabled",
      POST_QUOTA_ENABLED: "post_quota_enabled",
      STRIPE_PAYMENTS_ENABLED: "stripe_payments_enabled"
    };
    DEFAULT_FEATURES = {
      [FEATURE_KEYS.SUBSCRIPTIONS_ENABLED]: true,
      [FEATURE_KEYS.POST_QUOTA_ENABLED]: true,
      [FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED]: true
    };
    featureCache = /* @__PURE__ */ new Map();
  }
});

// server/admin-config.ts
function getUserPermissions(role, customPermissions = []) {
  const roleConfig = ROLE_CONFIG[role];
  const rolePermissions = roleConfig?.permissions || [];
  const allPermissions = [...rolePermissions, ...customPermissions];
  return Array.from(new Set(allPermissions));
}
function hasPermission(role, permission, customPermissions = []) {
  const permissions = getUserPermissions(role, customPermissions);
  return permissions.includes(permission);
}
function canAccessAdmin(role) {
  return ROLE_CONFIG[role]?.canAccessAdmin || false;
}
function getAvailableFeatures(userPermissions) {
  return ADMIN_FEATURES.filter((feature) => {
    if (!feature.enabled) return false;
    return feature.requiredPermissions.some((perm) => userPermissions.includes(perm));
  });
}
var ROLE_CONFIG, ADMIN_FEATURES;
var init_admin_config = __esm({
  "server/admin-config.ts"() {
    "use strict";
    ROLE_CONFIG = {
      user: {
        role: "user",
        label: "User",
        description: "Standard user with basic access",
        permissions: [],
        canManageRoles: false,
        canAccessAdmin: false
      },
      admin: {
        role: "admin",
        label: "Admin",
        description: "Administrator with management capabilities",
        permissions: [
          "users.view",
          "users.edit",
          "features.manage",
          "settings.view",
          "analytics.view",
          "posts.moderate"
        ],
        canManageRoles: false,
        canAccessAdmin: true
      },
      super_admin: {
        role: "super_admin",
        label: "Super Admin",
        description: "Full system access with all permissions",
        permissions: [
          "users.view",
          "users.create",
          "users.edit",
          "users.delete",
          "users.manage_roles",
          "features.manage",
          "settings.view",
          "settings.edit",
          "analytics.view",
          "posts.moderate",
          "subscriptions.manage",
          "system.manage"
        ],
        canManageRoles: true,
        canAccessAdmin: true
      }
    };
    ADMIN_FEATURES = [
      {
        id: "user-management",
        label: "User Management",
        description: "View, create, edit, and manage users",
        icon: "Users",
        path: "/admin/users",
        requiredPermissions: ["users.view"],
        enabled: true,
        category: "users"
      },
      {
        id: "feature-flags",
        label: "Feature Flags",
        description: "Manage application feature flags",
        icon: "Settings",
        path: "/admin/features",
        requiredPermissions: ["features.manage"],
        enabled: true,
        category: "features"
      },
      {
        id: "system-settings",
        label: "System Settings",
        description: "Configure system-wide settings",
        icon: "Cog",
        path: "/admin/settings",
        requiredPermissions: ["settings.view"],
        enabled: true,
        category: "settings"
      },
      {
        id: "analytics",
        label: "System Analytics",
        description: "View system-wide statistics and analytics",
        icon: "BarChart",
        path: "/admin/analytics",
        requiredPermissions: ["analytics.view"],
        enabled: true,
        category: "analytics"
      },
      {
        id: "subscriptions",
        label: "Subscription Management",
        description: "Manage user subscriptions and tiers",
        icon: "CreditCard",
        path: "/admin/subscriptions",
        requiredPermissions: ["subscriptions.manage"],
        enabled: true,
        category: "system"
      }
    ];
  }
});

// server/middleware/rbac.ts
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = req.user;
    const role = user.role || "user";
    const customPermissions = user.permissions || [];
    if (!hasPermission(role, permission, customPermissions)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `You don't have permission to ${permission}`
      });
    }
    next();
  };
}
function requireAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = req.user;
  const role = user.role || "user";
  if (!canAccessAdmin(role)) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Admin access required"
    });
  }
  next();
}
var init_rbac = __esm({
  "server/middleware/rbac.ts"() {
    "use strict";
    init_admin_config();
  }
});

// server/routes-admin.ts
var routes_admin_exports = {};
__export(routes_admin_exports, {
  registerAdminRoutes: () => registerAdminRoutes
});
import { z as z2 } from "zod";
import { eq as eq3, and as and2, desc as desc2, count, sql as sql3 } from "drizzle-orm";
function registerAdminRoutes(app2) {
  app2.get(
    "/api/admin/users",
    requirePermission("users.view"),
    async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        const role = req.query.role;
        const offset = (page - 1) * limit;
        const conditions = [eq3(schema_exports.users.isDeleted, false)];
        if (search) {
          conditions.push(
            sql3`(${schema_exports.users.username} ILIKE ${`%${search}%`} OR ${schema_exports.users.email} ILIKE ${`%${search}%`})`
          );
        }
        if (role) {
          conditions.push(eq3(schema_exports.users.role, role));
        }
        const query = db.select({
          id: schema_exports.users.id,
          username: schema_exports.users.username,
          email: schema_exports.users.email,
          role: schema_exports.users.role,
          permissions: schema_exports.users.permissions,
          isActive: schema_exports.users.isActive,
          isDeleted: schema_exports.users.isDeleted,
          createdAt: schema_exports.users.createdAt,
          updatedAt: schema_exports.users.updatedAt
        }).from(schema_exports.users).where(and2(...conditions)).orderBy(desc2(schema_exports.users.createdAt)).limit(limit).offset(offset);
        const users2 = await query;
        const totalResult = await db.select({ count: count() }).from(schema_exports.users).where(eq3(schema_exports.users.isDeleted, false));
        const total = totalResult[0]?.count || 0;
        res.json({
          users: users2.map((u) => ({
            ...u,
            permissions: u.permissions || []
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
      }
    }
  );
  app2.get(
    "/api/admin/users/:id",
    requirePermission("users.view"),
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json({
          ...userWithoutPassword,
          permissions: user.permissions || []
        });
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Failed to fetch user" });
      }
    }
  );
  app2.post(
    "/api/admin/users",
    requirePermission("users.create"),
    async (req, res) => {
      try {
        const body = z2.object({
          username: z2.string().min(3).max(30),
          email: z2.string().email(),
          password: z2.string().min(8),
          role: z2.enum(["user", "admin", "super_admin"]).optional(),
          permissions: z2.array(z2.string()).optional()
        }).parse(req.body);
        const existingUser = await storage.getUserByUsername(body.username);
        if (existingUser) {
          return res.status(400).json({ error: "Username already exists" });
        }
        const hashedPassword = await hashPassword(body.password);
        const user = await storage.createUser({
          username: body.username,
          email: body.email,
          password: hashedPassword,
          role: body.role || "user",
          permissions: body.permissions || []
        });
        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json({
          ...userWithoutPassword,
          permissions: user.permissions || []
        });
      } catch (error) {
        console.error("Error creating user:", error);
        if (error instanceof z2.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create user" });
      }
    }
  );
  app2.patch(
    "/api/admin/users/:id",
    requirePermission("users.edit"),
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const body = z2.object({
          email: z2.string().email().optional(),
          role: z2.enum(["user", "admin", "super_admin"]).optional(),
          permissions: z2.array(z2.string()).optional(),
          isActive: z2.boolean().optional()
        }).parse(req.body);
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        const updates = {
          updatedAt: /* @__PURE__ */ new Date()
        };
        if (body.email) updates.email = body.email;
        if (body.role) updates.role = body.role;
        if (body.permissions !== void 0) updates.permissions = body.permissions;
        if (body.isActive !== void 0) updates.isActive = body.isActive;
        await db.update(schema_exports.users).set(updates).where(eq3(schema_exports.users.id, userId));
        const updatedUser = await storage.getUser(userId);
        const { password: _, ...userWithoutPassword } = updatedUser;
        res.json({
          ...userWithoutPassword,
          permissions: updatedUser.permissions || []
        });
      } catch (error) {
        console.error("Error updating user:", error);
        if (error instanceof z2.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to update user" });
      }
    }
  );
  app2.delete(
    "/api/admin/users/:id",
    requirePermission("users.delete"),
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const currentUserId = req.user.id;
        if (userId === currentUserId) {
          return res.status(400).json({ error: "Cannot delete your own account" });
        }
        await db.update(schema_exports.users).set({
          isDeleted: true,
          deletedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq3(schema_exports.users.id, userId));
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Failed to delete user" });
      }
    }
  );
  app2.get(
    "/api/admin/features",
    requirePermission("features.manage"),
    async (req, res) => {
      try {
        const features = await getAllFeatureFlags();
        res.json({ features });
      } catch (error) {
        console.error("Error fetching feature flags:", error);
        res.status(500).json({ error: "Failed to fetch feature flags" });
      }
    }
  );
  app2.post(
    "/api/admin/features/:key",
    requirePermission("features.manage"),
    async (req, res) => {
      try {
        const { key } = req.params;
        const { value } = z2.object({ value: z2.boolean() }).parse(req.body);
        if (!Object.values(FEATURE_KEYS).includes(key)) {
          return res.status(400).json({ error: "Invalid feature key" });
        }
        await updateFeatureFlag(key, value, req.user.id);
        res.json({ success: true, key, value });
      } catch (error) {
        console.error("Error updating feature flag:", error);
        res.status(500).json({ error: "Failed to update feature flag" });
      }
    }
  );
  app2.get(
    "/api/admin/statistics",
    requirePermission("analytics.view"),
    async (req, res) => {
      try {
        const totalUsers = await db.select({ count: count() }).from(schema_exports.users).where(eq3(schema_exports.users.isDeleted, false));
        const activeUsers = await db.select({ count: count() }).from(schema_exports.users).where(and2(eq3(schema_exports.users.isDeleted, false), eq3(schema_exports.users.isActive, true)));
        const totalPosts = await db.select({ count: count() }).from(schema_exports.posts).where(eq3(schema_exports.posts.isDeleted, false));
        const publishedPosts = await db.select({ count: count() }).from(schema_exports.posts).where(
          and2(
            eq3(schema_exports.posts.isDeleted, false),
            eq3(schema_exports.posts.status, "published")
          )
        );
        const scheduledPosts = await db.select({ count: count() }).from(schema_exports.posts).where(
          and2(
            eq3(schema_exports.posts.isDeleted, false),
            eq3(schema_exports.posts.status, "scheduled")
          )
        );
        const totalSubscriptions = await db.select({ count: count() }).from(schema_exports.subscriptions);
        const activeSubscriptions = await db.select({ count: count() }).from(schema_exports.subscriptions).where(eq3(schema_exports.subscriptions.status, "active"));
        const roleDistribution = await db.select({
          role: schema_exports.users.role,
          count: count()
        }).from(schema_exports.users).where(eq3(schema_exports.users.isDeleted, false)).groupBy(schema_exports.users.role);
        res.json({
          users: {
            total: totalUsers[0]?.count || 0,
            active: activeUsers[0]?.count || 0,
            roles: roleDistribution
          },
          posts: {
            total: totalPosts[0]?.count || 0,
            published: publishedPosts[0]?.count || 0,
            scheduled: scheduledPosts[0]?.count || 0
          },
          subscriptions: {
            total: totalSubscriptions[0]?.count || 0,
            active: activeSubscriptions[0]?.count || 0
          }
        });
      } catch (error) {
        console.error("Error fetching statistics:", error);
        res.status(500).json({ error: "Failed to fetch statistics" });
      }
    }
  );
  app2.get(
    "/api/admin/config",
    requireAdmin,
    async (req, res) => {
      try {
        const user = req.user;
        const role = user.role || "user";
        const customPermissions = user.permissions || [];
        const permissions = getUserPermissions(role, customPermissions);
        const availableFeatures = getAvailableFeatures(permissions);
        res.json({
          roles: ROLE_CONFIG,
          availableFeatures,
          userPermissions: permissions,
          userRole: role
        });
      } catch (error) {
        console.error("Error fetching admin config:", error);
        res.status(500).json({ error: "Failed to fetch admin config" });
      }
    }
  );
}
var init_routes_admin = __esm({
  "server/routes-admin.ts"() {
    "use strict";
    init_storage();
    init_db();
    init_rbac();
    init_feature_config();
    init_admin_config();
    init_auth();
  }
});

// server/index.ts
import express3 from "express";

// server/routes.ts
init_auth();
init_storage();
import { createServer } from "http";
import { z as z3 } from "zod";
import multer from "multer";
import path3 from "path";

// client/src/lib/types/subscription.ts
import Stripe from "stripe";
var stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-08-16"
});
var createSubscription = async (req, res) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { priceId } = req.body;
  if (!priceId) {
    return res.status(400).json({ error: "Missing priceId" });
  }
  try {
    const session4 = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/canceled`,
      metadata: {
        userId: req.user.id.toString()
      }
    });
    return res.status(200).json({ sessionId: session4.id });
  } catch (error) {
    console.error("Stripe subscription error:", error);
    return res.status(500).json({ error: error.message || "Failed to create subscription" });
  }
};

// client/src/lib/types/webhooks.ts
init_storage();
import Stripe2 from "stripe";
var stripe2 = new Stripe2(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-08-16"
});
var handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ error: "Missing or invalid Stripe signature" });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("\u274C STRIPE_WEBHOOK_SECRET not set.");
    return res.status(500).json({ error: "Server configuration error" });
  }
  let event;
  try {
    event = stripe2.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("\u26A0\uFE0F Stripe signature verification failed:", err);
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }
  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (!subscriptionId) break;
        const subscription = await storage.getSubscriptionByStripeId(subscriptionId);
        if (subscription) {
          await storage.updateSubscription(subscription.id, {
            currentPeriodStart: new Date(invoice.period_start * 1e3),
            currentPeriodEnd: new Date(invoice.period_end * 1e3),
            postsUsed: 0,
            status: "active"
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const stripeSubscription = event.data.object;
        const subscription = await storage.getSubscriptionByStripeId(stripeSubscription.id);
        if (subscription) {
          await storage.updateSubscription(subscription.id, {
            status: "canceled",
            ...subscription.hasOwnProperty("canceledAt") && {
              canceledAt: /* @__PURE__ */ new Date()
            }
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        break;
      }
      default:
        console.log(`\u2139\uFE0F Unhandled event type: ${event.type}`);
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error("\u274C Webhook handler error:", error);
    return res.status(500).json({ error: "Internal webhook error" });
  }
};

// server/routes.ts
import bodyParser from "body-parser";
import fsp2 from "fs/promises";
import axios3 from "axios";
import express from "express";

// server/schedulePost.ts
import cron from "node-cron";

// server/publishPost.ts
import axios2 from "axios";

// server/uploadToMedia.ts
import path from "path";
import fs from "fs";
import FormData from "form-data";
import axios from "axios";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname2 = path.dirname(__filename);
var uploadMediaToPlatforms = async (accessToken, targetId, mediaUrls, mediaType, platform) => {
  const mediaIds = [];
  for (const mediaUrl of mediaUrls) {
    const filePath = path.join(__dirname2, "..", mediaUrl);
    if (platform === "facebook") {
      const formData = new FormData();
      if (mediaType === "image") {
        formData.append("source", fs.createReadStream(filePath));
        formData.append("access_token", accessToken);
        formData.append("published", "false");
        const uploadResponse = await axios.post(
          `https://graph.facebook.com/v22.0/${targetId}/photos`,
          formData,
          {
            headers: {
              ...formData.getHeaders()
            }
          }
        );
        if (!uploadResponse.data || uploadResponse.data.error) {
          throw new Error(
            uploadResponse.data.error?.message || "Facebook API error"
          );
        }
        mediaIds.push({ media_fbid: uploadResponse.data.id });
      } else if (mediaType === "video") {
        const initResponse = await axios.post(
          `https://graph.facebook.com/v22.0/${targetId}/videos`,
          {
            upload_phase: "start",
            access_token: accessToken,
            file_size: fs.statSync(filePath).size,
            published: false
            // Set to false to upload without publishing immediately
          }
        );
        if (!initResponse.data || initResponse.data.error) {
          throw new Error(
            initResponse.data.error?.message || "Failed to initialize Facebook video upload"
          );
        }
        const { upload_session_id, video_id } = initResponse.data;
        const videoFormData = new FormData();
        videoFormData.append("source", fs.createReadStream(filePath));
        videoFormData.append("upload_session_id", upload_session_id);
        videoFormData.append("access_token", accessToken);
        try {
          const uploadResponse = await axios.post(
            `https://graph-video.facebook.com/v22.0/${upload_session_id}`,
            videoFormData,
            {
              headers: {
                ...videoFormData.getHeaders(),
                "Content-Length": fs.statSync(filePath).size
                // Ensure the file size is included
              }
            }
          );
          if (!uploadResponse.data || uploadResponse.data.error) {
            throw new Error(
              uploadResponse.data.error?.message || "Failed to upload video to Facebook"
            );
          }
        } catch (uploadError) {
          const error = uploadError;
          console.error(
            "Facebook video upload error:",
            error.response?.data || error.message
          );
          throw new Error("Failed to upload video to Facebook");
        }
        const publishResponse = await axios.post(
          `https://graph.facebook.com/v22.0/${targetId}/videos`,
          {
            upload_phase: "finish",
            upload_session_id,
            access_token: accessToken,
            published: true
            // Set to true to publish the video
          }
        );
        if (!publishResponse.data || publishResponse.data.error) {
          throw new Error(
            publishResponse.data.error?.message || "Failed to publish video on Facebook"
          );
        }
        mediaIds.push({ media_fbid: video_id });
      }
    } else if (platform === "instagram") {
      const createMediaResponse = await axios.post(
        `https://graph.facebook.com/v22.0/${targetId}/media`,
        {
          access_token: accessToken,
          ...mediaType === "image" ? { image_url: `file://${filePath}` } : { video_url: `file://${filePath}` }
        }
      );
      if (!createMediaResponse.data || createMediaResponse.data.error) {
        throw new Error(
          createMediaResponse.data.error?.message || "Instagram API error"
        );
      }
      mediaIds.push({ media_fbid: createMediaResponse.data.id });
    } else {
      throw new Error("Unsupported platform");
    }
  }
  return mediaIds;
};

// server/publishPost.ts
init_storage();
import fsp from "fs/promises";
import path2 from "path";
var publishPost = async (postId) => {
  const post = await storage.getPost(postId);
  if (!post) {
    throw new Error("Post not found");
  }
  const user = await storage.getUser(post.userId);
  if (!user) {
    throw new Error("User not found");
  }
  const errors = [];
  if (!Array.isArray(post.platforms)) {
    throw new Error("Platforms must be an array");
  }
  if (!Array.isArray(post.mediaUrls)) {
    throw new Error("mediaUrls must be an array of strings");
  }
  if (post.mediaType === null) {
    throw new Error("mediaType cannot be null");
  }
  const mediaType = post.mediaType;
  for (const platform of post.platforms) {
    try {
      switch (platform) {
        case "facebook-personal":
          if (!user.facebookPersonalToken) {
            errors.push({
              platform: "Facebook Personal",
              error: "Facebook Personal Account not connected"
            });
            break;
          }
          if (mediaType === "pdf") {
            errors.push({
              platform: "Facebook Personal",
              error: "PDF uploads are not supported on Facebook"
            });
            break;
          }
          const fbPersonalEndpoint = `https://graph.facebook.com/v22.0/me/feed`;
          let fbPersonalData = {
            message: post.content,
            access_token: user.facebookPersonalToken
          };
          if (mediaType === "image" || mediaType === "video") {
            const mediaIds = await uploadMediaToPlatforms(
              user.facebookPersonalToken,
              "me",
              post.mediaUrls,
              // Type assertion
              mediaType,
              "facebook"
              // Specify the platform
            );
            fbPersonalData.attached_media = mediaIds;
          }
          const fbPersonalResponse = await axios2.post(
            fbPersonalEndpoint,
            fbPersonalData,
            {
              headers: { "Content-Type": "application/json" }
            }
          );
          if (!fbPersonalResponse.data || fbPersonalResponse.data.error) {
            errors.push({
              platform: "Facebook Personal",
              error: fbPersonalResponse.data.error?.message || "Facebook API error"
            });
          } else {
            console.log(`\u2705 Successfully posted to Facebook Personal: ${fbPersonalResponse.data.id}`);
          }
          break;
        case "facebook-page":
          if (!user.facebookPageToken || !user.facebookPageId) {
            errors.push({
              platform: "Facebook Page",
              error: "Facebook Page not connected"
            });
            break;
          }
          if (mediaType === "pdf") {
            errors.push({
              platform: "Facebook Page",
              error: "PDF uploads are not supported on Facebook"
            });
            break;
          }
          const fbPageEndpoint = `https://graph.facebook.com/v22.0/${user.facebookPageId}/feed`;
          let fbPageData = {
            message: post.content,
            access_token: user.facebookPageToken
          };
          if (mediaType === "image" || mediaType === "video") {
            const mediaIds = await uploadMediaToPlatforms(
              user.facebookPageToken,
              user.facebookPageId,
              post.mediaUrls,
              // Type assertion
              mediaType,
              "facebook"
              // Specify the platform
            );
            fbPageData.attached_media = mediaIds;
          }
          const fbPageResponse = await axios2.post(fbPageEndpoint, fbPageData, {
            headers: { "Content-Type": "application/json" }
          });
          if (!fbPageResponse.data || fbPageResponse.data.error) {
            errors.push({
              platform: "Facebook Page",
              error: fbPageResponse.data.error?.message || "Facebook API error"
            });
          } else {
            console.log(`\u2705 Successfully posted to Facebook Page: ${fbPageResponse.data.id}`);
          }
          break;
        case "instagram":
          if (!user.facebookPageToken || !user.facebookPageId) {
            errors.push({
              platform: "Instagram",
              error: "Facebook Page not connected"
            });
            break;
          }
          if (mediaType !== "image" && mediaType !== "video") {
            errors.push({
              platform: "Instagram",
              error: "Instagram posts must include an image or video alongside text."
            });
            break;
          }
          const pageInfoResponse = await axios2.get(
            `https://graph.facebook.com/v22.0/${user.facebookPageId}`,
            {
              params: {
                fields: "instagram_business_account",
                access_token: user.facebookPageToken
              }
            }
          );
          const instagramBusinessAccountId = pageInfoResponse.data.instagram_business_account?.id;
          if (!instagramBusinessAccountId) {
            errors.push({
              platform: "Instagram",
              error: "No Instagram Business Account linked to this Facebook Page"
            });
            break;
          }
          try {
            const mediaIds = await uploadMediaToPlatforms(
              user.facebookPageToken,
              instagramBusinessAccountId,
              post.mediaUrls,
              mediaType,
              "instagram"
              // Specify the platform
            );
            console.log("Instagram media uploaded and published successfully:", mediaIds);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to post to Instagram";
            errors.push({
              platform: "Instagram",
              error: errorMessage
            });
          }
          break;
        case "linkedin":
          if (!user.linkedinToken || !user.linkedinUserProfile) {
            throw new Error("LinkedIn not connected");
          }
          try {
            const linkedinProfile = user.linkedinUserProfile;
            if (!linkedinProfile?.sub) {
              throw new Error("LinkedIn profile missing user ID");
            }
            let registerUpload;
            let uploadData;
            const mediaAssets = [];
            if (mediaType !== "text") {
              for (const mediaUrl of post.mediaUrls) {
                const filePath = path2.join(__dirname, "..", mediaUrl);
                registerUpload = await fetch(
                  "https://api.linkedin.com/v2/assets?action=registerUpload",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${user.linkedinToken}`,
                      "X-Restli-Protocol-Version": "2.0.0"
                    },
                    body: JSON.stringify({
                      registerUploadRequest: {
                        recipes: [
                          mediaType === "video" ? "urn:li:digitalmediaRecipe:feedshare-video" : mediaType === "pdf" ? "urn:li:digitalmediaRecipe:feedshare-document" : "urn:li:digitalmediaRecipe:feedshare-image"
                        ],
                        owner: `urn:li:person:${linkedinProfile.sub}`,
                        serviceRelationships: [
                          {
                            relationshipType: "OWNER",
                            identifier: "urn:li:userGeneratedContent"
                          }
                        ]
                      }
                    })
                  }
                );
                if (!registerUpload.ok) {
                  const error = await registerUpload.json();
                  console.error(
                    "LinkedIn API Error (Register Upload):",
                    JSON.stringify(error, null, 2)
                  );
                  throw new Error(
                    error.message || "LinkedIn media registration failed"
                  );
                }
                uploadData = await registerUpload.json();
                const upload2 = await fetch(
                  uploadData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${user.linkedinToken}`
                    },
                    body: await fsp.readFile(filePath)
                  }
                );
                if (!upload2.ok) {
                  throw new Error("LinkedIn media upload failed");
                }
                mediaAssets.push({
                  status: "READY",
                  media: uploadData.value.asset
                });
              }
            }
            const postData = {
              author: `urn:li:person:${linkedinProfile.sub}`,
              lifecycleState: "PUBLISHED",
              specificContent: {
                "com.linkedin.ugc.ShareContent": {
                  shareCommentary: {
                    text: post.content
                  },
                  shareMediaCategory: mediaType === "text" ? "NONE" : mediaType.toUpperCase(),
                  ...mediaType !== "text" && {
                    media: mediaAssets
                  }
                }
              },
              visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
              }
            };
            const linkedinResponse = await fetch(
              "https://api.linkedin.com/v2/ugcPosts",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${user.linkedinToken}`,
                  "X-Restli-Protocol-Version": "2.0.0"
                },
                body: JSON.stringify(postData)
              }
            );
            if (!linkedinResponse.ok) {
              const error = await linkedinResponse.json();
              console.error("LinkedIn API Error:", error);
              throw new Error(error.message || "LinkedIn API error");
            }
          } catch (platformError) {
            console.error("Failed to post to LinkedIn:", platformError);
            await storage.updatePostStatus(post.id, "error_linkedin");
            continue;
          }
          break;
        default:
          errors.push({
            platform,
            error: "Unsupported platform"
          });
          break;
      }
    } catch (platformError) {
      console.error(`Failed to post to ${platform}:`, platformError);
      await storage.updatePostStatus(post.id, `error_${platform}`);
      continue;
    }
  }
  await storage.updatePostStatus(post.id, "published");
};

// server/schedulePost.ts
init_storage();
var schedulePost = (postId, scheduledTime, timezone) => {
  const localTime = new Date(
    scheduledTime.toLocaleString("en-US", { timeZone: timezone })
  );
  const cronExpression = `${localTime.getMinutes()} ${localTime.getHours()} ${localTime.getDate()} ${localTime.getMonth() + 1} *`;
  console.log("Cron Expression:", cronExpression);
  console.log("Scheduled Time (Local):", localTime.toLocaleString());
  console.log("Scheduled Time (UTC):", scheduledTime.toISOString());
  cron.schedule(
    cronExpression,
    async () => {
      console.log(`Cron job triggered for post ${postId}`);
      try {
        await publishPost(postId);
        console.log(`Post ${postId} published successfully.`);
      } catch (error) {
        console.error(`Failed to publish post ${postId}:`, error);
      }
    },
    {
      timezone
    }
  );
};
async function initializeScheduledPosts() {
  try {
    const users2 = await storage.getAllUsers();
    for (const user of users2) {
      const scheduledPosts = await storage.getScheduledPosts(user.id);
      for (const post of scheduledPosts) {
        if (post.scheduledTime && post.timezone) {
          const scheduledTime = new Date(post.scheduledTime);
          schedulePost(post.id, scheduledTime, post.timezone);
          console.log(
            `Reinitialized cron job for post ${post.id} (User: ${user.id})`
          );
        }
      }
    }
  } catch (error) {
    console.error("Failed to initialize scheduled posts:", error);
  }
}

// server/routes.ts
init_schema();

// client/src/lib/postQuota.ts
init_storage();

// client/src/lib/packages.ts
var PACKAGES = {
  STARTER: {
    id: "starter",
    posts: 40,
    price: 500,
    // ₹500 or ฿220
    features: ["1 post/hour max"]
  },
  PRO: {
    id: "pro",
    posts: 150,
    price: 1850,
    // ₹1,850 or ฿800
    features: ["5 posts/hour max"]
  },
  ENTERPRISE: {
    id: "enterprise",
    posts: 3e3,
    price: 5e3,
    features: ["Unlimited posting"]
  }
};

// client/src/lib/postQuota.ts
init_feature_config();
var checkPostQuota = async (req, res, next) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  if (!isFeatureEnabled(FEATURE_KEYS.POST_QUOTA_ENABLED)) {
    req.quota = {
      tier: "UNLIMITED",
      used: 0,
      max: Infinity,
      remaining: Infinity
    };
    return next();
  }
  try {
    const user = req.user;
    const currentMonth = (/* @__PURE__ */ new Date()).getMonth();
    const userPosts = await storage.getUserPostCount(user.id, currentMonth);
    const userPackage = await storage.getUserPackage(user.id);
    const tier = userPackage?.tier || "STARTER";
    const maxPosts = PACKAGES[tier].posts;
    if (userPosts >= maxPosts) {
      return res.status(429).json({
        error: "Post quota exceeded",
        upgradeUrl: `/upgrade?tier=${tier.toLowerCase()}`,
        quota: {
          used: userPosts,
          max: maxPosts,
          remaining: Math.max(0, maxPosts - userPosts)
        }
      });
    }
    req.quota = {
      tier,
      used: userPosts,
      max: maxPosts,
      remaining: maxPosts - userPosts
    };
    next();
  } catch (err) {
    console.error("Quota check failed:", err);
    next(err);
  }
};

// client/src/lib/rateLimiter.ts
init_storage();

// client/src/lib/types/platformTypes.ts
var PLATFORMS = [
  "facebook-personal",
  "facebook-page",
  "instagram",
  "linkedin",
  "linkedin-page",
  "twitter",
  "youtube",
  "tiktok",
  "pinterest",
  "snapchat"
];

// client/src/lib/rateLimiter.ts
var PLATFORM_LIMITS = {
  "facebook-personal": { free: 2, pro: 10, enterprise: 50 },
  "facebook-page": { free: 4, pro: 15, enterprise: 100 },
  "instagram": { free: 1, pro: 5, enterprise: 30 },
  "linkedin": { free: 2, pro: 8, enterprise: 40 },
  "linkedin-page": { free: 2, pro: 8, enterprise: 40 },
  "twitter": { free: 1, pro: 5, enterprise: 25 },
  "youtube": { free: 1, pro: 3, enterprise: 15 },
  "tiktok": { free: 1, pro: 4, enterprise: 20 },
  "pinterest": { free: 2, pro: 6, enterprise: 30 },
  "snapchat": { free: 1, pro: 3, enterprise: 15 }
};
function isPlatform(name) {
  return PLATFORMS.includes(name);
}
function isValidTier(tier) {
  return tier === "free" || tier === "pro" || tier === "enterprise";
}
var checkPlatformRateLimit = async (userId, platform) => {
  if (!isPlatform(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  const userPackage = await storage.getUserPackage(userId);
  const tier = isValidTier(userPackage?.tier) ? userPackage.tier : "free";
  const limit = PLATFORM_LIMITS[platform][tier];
  const lastHourPosts = await storage.getUserPlatformPostsLastHour(userId, platform);
  const remaining = Math.max(0, limit - lastHourPosts);
  return {
    allowed: lastHourPosts < limit,
    limit,
    remaining,
    tier
  };
};

// server/routes.ts
init_feature_config();
var upload = multer({
  storage: multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path3.extname(file.originalname)
      );
    }
  })
});
async function registerRoutes(app2) {
  setupAuth(app2);
  await initializeScheduledPosts();
  app2.use(bodyParser.json());
  app2.use(bodyParser.urlencoded({ extended: true }));
  await fsp2.mkdir("./uploads", { recursive: true });
  app2.get("/api/auth/:platform", (req, res) => {
    const { platform } = req.params;
    try {
      const state = JSON.stringify({
        type: platform === "facebook-personal" ? "personal" : "page"
      });
      const stateLinkedin = JSON.stringify({
        type: platform === "linkedin" ? "personal" : "page"
      });
      const getAuthUrl = (platform2) => {
        switch (platform2) {
          case "facebook-personal":
            return `https://www.facebook.com/v22.0/dialog/oauth?client_id=${process.env.META_PERSONAL_APP_ID}&redirect_uri=${process.env.META_REDIRECT_URI}&state=${encodeURIComponent(
              state
            )}&scope=user_posts`;
          case "facebook-page":
            return `https://www.facebook.com/v22.0/dialog/oauth?client_id=${process.env.META_PAGE_APP_ID}&redirect_uri=${process.env.META_REDIRECT_URI}&state=${encodeURIComponent(
              state
            )}&scope=pages_show_list,pages_manage_posts,pages_read_engagement`;
          case "linkedin":
            return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${process.env.LINKEDIN_REDIRECT_URI}&scope=profile email openid w_member_social&state=${encodeURIComponent(
              stateLinkedin
            )}`;
          default:
            throw new Error("Unsupported platform");
        }
      };
      const authUrl = getAuthUrl(platform);
      res.json({ authUrl });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app2.get("/api/facebook/auth/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/auth");
    const { code, state } = req.query;
    console.log(state, "Raw state from Facebook");
    if (!code) {
      return res.redirect(`/?error=facebook_auth_failed&reason=no_code`);
    }
    try {
      const parsedState = state ? JSON.parse(decodeURIComponent(state)) : {};
      const type = parsedState.type;
      console.log(type, "Extracted type");
      if (!type) {
        throw new Error("Missing type in state");
      }
      const isPersonal = type === "personal";
      const clientId = isPersonal ? process.env.META_PERSONAL_APP_ID : process.env.META_PAGE_APP_ID;
      const clientSecret = isPersonal ? process.env.META_PERSONAL_APP_SECRET : process.env.META_PAGE_APP_SECRET;
      const redirectUri = process.env.META_REDIRECT_URI;
      console.log(isPersonal, ":-- personal or page");
      const tokenResponse = await axios3.get(
        `https://graph.facebook.com/v22.0/oauth/access_token`,
        {
          params: {
            client_id: clientId,
            redirect_uri: redirectUri,
            client_secret: clientSecret,
            code
          }
        }
      );
      const { access_token: userAccessToken } = tokenResponse.data;
      if (!userAccessToken) {
        throw new Error(
          tokenResponse.data.error?.message || "Failed to retrieve user access token"
        );
      }
      const validateResponse = await fetch(
        `https://graph.facebook.com/v22.0/debug_token?input_token=${userAccessToken}&access_token=${userAccessToken}`
      );
      const validateData = await validateResponse.json();
      console.log(validateData, "validate");
      console.log(userAccessToken, "userAccessToken");
      if (!validateResponse.ok || !validateData.data?.is_valid) {
        throw new Error("Invalid access token received");
      }
      if (isPersonal) {
        await storage.updateUserFacebookPersonalToken(
          req.user.id,
          userAccessToken
        );
        return res.redirect(`/?facebook_personal_connected=true`);
      }
      const pagesResponse = await axios3.get(
        `https://graph.facebook.com/v22.0/me/accounts`,
        {
          params: { access_token: userAccessToken }
        }
      );
      if (!pagesResponse.data || !pagesResponse.data.data.length) {
        throw new Error("No pages found for this user");
      }
      const page = pagesResponse.data.data[0];
      const pageAccessToken = page.access_token;
      const pageId = page.id;
      if (!pageAccessToken) {
        throw new Error("Failed to fetch Facebook pages");
      }
      await storage.updateUserFacebookPageToken(
        req.user.id,
        pageAccessToken,
        pageId
      );
      res.redirect(`/?facebook_page_connected=true`);
    } catch (error) {
      console.error("Facebook OAuth error:", error);
      res.redirect(`/?error=facebook_auth_failed&reason=api_error`);
    }
  });
  app2.get("/api/auth/linkedin/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/auth");
    const { code } = req.query;
    if (!code) {
      return res.redirect(`/?error=linkedin_auth_failed&reason=no_code`);
    }
    try {
      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      });
      const tokenResponse = await axios3.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        tokenParams.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );
      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        throw new Error("Failed to obtain access token");
      }
      const profileResponse = await axios3.get(
        "https://api.linkedin.com/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      const userProfile = profileResponse.data;
      if (!userProfile) {
        throw new Error("Failed to retrieve user profile");
      }
      await storage.updateUserLinkedInToken(
        req.user.id,
        accessToken,
        userProfile
      );
      res.redirect(`/?linkedin_connected=true`);
    } catch (error) {
      console.error("LinkedIn OAuth error:", error);
      res.redirect(`/?error=linkedin_auth_failed&reason=api_error`);
    }
  });
  app2.post("/api/subscription", async (req, res) => {
    if (!isFeatureEnabled(FEATURE_KEYS.SUBSCRIPTIONS_ENABLED)) {
      return res.status(403).json({
        error: "Subscriptions are currently disabled",
        featureDisabled: true
      });
    }
    if (!isFeatureEnabled(FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED)) {
      return res.status(403).json({
        error: "Payment processing is currently disabled",
        featureDisabled: true
      });
    }
    return createSubscription(req, res);
  });
  app2.post(
    "/api/webhooks/stripe",
    bodyParser.raw({ type: "application/json" }),
    async (req, res) => {
      if (!isFeatureEnabled(FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED)) {
        return res.status(403).json({
          error: "Payment processing is currently disabled",
          featureDisabled: true
        });
      }
      return handleStripeWebhook(req, res);
    }
  );
  app2.post(
    "/api/posts",
    checkPostQuota,
    // Add this middleware
    upload.array("media"),
    async (req, res) => {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      try {
        const files = req.files;
        const user = req.user;
        const { content, platforms, mediaType, scheduledTime, timezone } = req.body;
        console.log("Received scheduledTime (raw):", scheduledTime);
        console.log("Received timezone:", timezone);
        let utcScheduledTime = null;
        if (scheduledTime) {
          const localTime = new Date(scheduledTime);
          utcScheduledTime = new Date(
            localTime.toLocaleString("en-US", { timeZone: timezone })
          );
          console.log(
            "Converted scheduledTime (UTC):",
            utcScheduledTime.toISOString()
          );
        }
        const parsedPlatforms = JSON.parse(platforms);
        const validatedPlatforms = insertPostSchema.shape.platforms.parse(parsedPlatforms);
        console.log(validatedPlatforms, "validate");
        const mediaUrls = files.map((file) => `/uploads/${file.filename}`);
        for (const platform of validatedPlatforms) {
          const allowed = await checkPlatformRateLimit(user.id, platform);
          if (!allowed) {
            throw new Error(`Rate limit exceeded for ${platform}`);
          }
        }
        const post = await storage.createPost(user.id, {
          content,
          scheduledTime: utcScheduledTime,
          platforms: validatedPlatforms,
          // Use the validated platforms
          mediaUrls,
          mediaType,
          timezone: "UTC",
          status: utcScheduledTime ? "scheduled" : "draft",
          analytics: {
            impressions: 0,
            clicks: 0,
            likes: 0,
            shares: 0,
            comments: 0
          }
        });
        if (utcScheduledTime) {
          schedulePost(post.id, utcScheduledTime, timezone);
        } else {
          await publishPost(post.id);
        }
        res.json(post);
      } catch (err) {
        console.error("Post creation error:", err);
        if (req.files) {
          const files = req.files;
          await Promise.all(
            files.map((file) => fsp2.unlink(file.path).catch(console.error))
          );
        }
        res.status(400).json({ error: err.message });
      }
    }
  );
  app2.get("/api/posts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const posts2 = await storage.getUserPosts(req.user.id);
      res.json(posts2);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app2.patch("/api/posts/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { status } = z3.object({ status: z3.string() }).parse(req.body);
      const post = await storage.updatePostStatus(
        parseInt(req.params.id),
        status
      );
      res.json(post);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app2.delete("/api/posts/:postId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const postId = parseInt(req.params.postId, 10);
      console.log("Deleting post with ID:", postId);
      const deletedPost = await storage.deletePost(postId);
      console.log("Successfully deleted post:", deletedPost);
      if (!deletedPost) {
        throw new Error(
          "Failed to delete post: Post not found or already deleted"
        );
      }
      res.status(200).json(deletedPost);
    } catch (err) {
      console.error("Error deleting post:", err);
      res.status(400).json({ error: err.message });
    }
  });
  app2.get("/api/subscription", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isFeatureEnabled(FEATURE_KEYS.SUBSCRIPTIONS_ENABLED)) {
      return res.json({
        plan: "free",
        status: "active",
        current_period_end: 0,
        posts_used: 0,
        posts_limit: Infinity,
        // Unlimited when feature is disabled
        featureDisabled: true
      });
    }
    try {
      const subscription = await storage.getUserSubscription(req.user.id);
      res.json({
        plan: subscription?.plan || "free",
        status: subscription?.status || "inactive",
        current_period_end: subscription?.periodEnd || 0,
        posts_used: subscription?.postsUsed || 0,
        posts_limit: subscription?.postsLimit || 5
        // Default free tier limit
      });
    } catch (error) {
      console.error("Subscription error:", error);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });
  const { registerAdminRoutes: registerAdminRoutes2 } = await Promise.resolve().then(() => (init_routes_admin(), routes_admin_exports));
  registerAdminRoutes2(app2);
  app2.use("/uploads", express.static("uploads"));
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs2 from "fs";
import path5, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path4, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath as fileURLToPath2 } from "url";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname3 = dirname(__filename2);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path4.resolve(__dirname3, "client", "src"),
      "@shared": path4.resolve(__dirname3, "shared")
    }
  },
  root: path4.resolve(__dirname3, "client"),
  build: {
    outDir: path4.resolve(__dirname3, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname4 = dirname2(__filename3);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server }
    // allowedHosts: true,
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith("/api/")) {
      return next();
    }
    try {
      const clientTemplate = path5.resolve(
        __dirname4,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path5.resolve(__dirname4, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path5.resolve(distPath, "index.html"));
  });
}

// server/index.ts
init_feature_config();
import rateLimit from "express-rate-limit";
var app = express3();
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
var apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 100
  // Limit each IP to 100 requests per window
});
app.use("/api/", apiLimiter);
app.use("/api/auth", rateLimit({
  windowMs: 60 * 1e3,
  max: 5
}));
app.use((req, res, next) => {
  const start = Date.now();
  const path6 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path6.startsWith("/api")) {
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  log(`Error: ${status} - ${message}`);
  if (status >= 500) {
    console.error(err);
  }
});
(async () => {
  try {
    await initializeFeatureFlags();
    const server = await registerRoutes(app);
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    const port = 9002;
    log(`Attempting to start server on port ${port}...`);
    server.listen(port, "0.0.0.0", () => {
      log(`Server is running on http://0.0.0.0:${port}`);
    }).on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        log(`Port ${port} is already in use. Trying another port...`);
        server.listen(port + 1, "0.0.0.0", () => {
          log(`Server is running on http://0.0.0.0:${port + 1}`);
        });
      } else {
        console.error("Server failed to start:", err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
    process.exit(1);
  }
})();
