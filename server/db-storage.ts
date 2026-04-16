import { eq, and, desc, sql, gte, lte, or } from "drizzle-orm";
import { db, schema } from "./db";
import { IStorage, Subscription, InsertSubscription } from "./storage";
import { User, InsertUser, Post, InsertPost } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

const MemoryStore = createMemoryStore(session);

// Create session store
// Use PostgreSQL session store if DATABASE_URL is available, otherwise fallback to memory store
function initializeSessionStore(): session.Store {
  if (!process.env.DATABASE_URL) {
    return new MemoryStore({
      checkPeriod: 86400000, // 1 day
    });
  }

  try {
    // Use require for connect-pg-simple (CommonJS module)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const connectPgSimple = require("connect-pg-simple")(session);
    
    // Create a separate pool for sessions
    const sessionPool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 5, // Smaller pool for sessions
    });

    const pgStore = new connectPgSimple({
      pool: sessionPool,
      tableName: "session",
      createTableIfMissing: true,
    });

    console.log("✅ Using PostgreSQL session store");
    return pgStore;
  } catch (error: any) {
    // Fallback to memory store if PostgreSQL session store fails
    // Only show warning if it's not a module resolution error (packages are installed)
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes("Cannot find module") && !errorMsg.includes("MODULE_NOT_FOUND")) {
      console.warn("⚠️  Using memory session store:", errorMsg);
    }
    return new MemoryStore({
      checkPeriod: 86400000, // 1 day
    });
  }
}

// Initialize session store
const sessionStore: session.Store = initializeSessionStore();

export class DbStorage implements IStorage {
  sessionStore: session.Store = sessionStore;

  // Subscription methods
  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const result = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);

    if (result.length === 0) return null;

    const sub = result[0];
    return {
      id: sub.id,
      userId: sub.userId,
      plan: sub.tierId.toString(), // Convert tierId to plan string
      status: sub.status,
      postsUsed: sub.postsUsed || 0,
      postsLimit: 0, // Will need to join with subscription_tiers
      periodStart: sub.currentPeriodStart.getTime(),
      periodEnd: sub.currentPeriodEnd.getTime(),
      stripeSubscriptionId: sub.stripeSubscriptionId,
      stripeCustomerId: "", // Will need to get from user
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    };
  }

  async getUserSubscription(userId: number): Promise<Subscription | null> {
    const result = await db
      .select({
        subscription: schema.subscriptions,
        tier: schema.subscriptionTiers,
        user: schema.users,
      })
      .from(schema.subscriptions)
      .innerJoin(schema.subscriptionTiers, eq(schema.subscriptions.tierId, schema.subscriptionTiers.id))
      .innerJoin(schema.users, eq(schema.subscriptions.userId, schema.users.id))
      .where(eq(schema.subscriptions.userId, userId))
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(1);

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
      updatedAt: sub.updatedAt,
    };
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    // Find tier by name
    const tierResult = await db
      .select()
      .from(schema.subscriptionTiers)
      .where(eq(schema.subscriptionTiers.name, subscription.plan))
      .limit(1);

    if (tierResult.length === 0) {
      throw new Error(`Subscription tier "${subscription.plan}" not found`);
    }

    const tierId = tierResult[0].id;
    const periodStart = new Date(subscription.periodStart * 1000);
    const periodEnd = new Date(subscription.periodEnd * 1000);

    const result = await db
      .insert(schema.subscriptions)
      .values({
        userId: subscription.userId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        tierId: tierId,
        status: subscription.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        postsUsed: subscription.postsUsed || 0,
      })
      .returning();

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
      updatedAt: sub.updatedAt,
    };
  }

  async updateSubscription(
    subscriptionId: number,
    updates: Partial<Subscription>
  ): Promise<Subscription> {
    const updateData: any = {};
    if (updates.status) updateData.status = updates.status;
    if (updates.postsUsed !== undefined) updateData.postsUsed = updates.postsUsed;
    if (updates.periodEnd !== undefined) {
      updateData.currentPeriodEnd = new Date(updates.periodEnd);
    }
    if (updates.periodStart !== undefined) {
      updateData.currentPeriodStart = new Date(updates.periodStart);
    }
    updateData.updatedAt = new Date();

    const result = await db
      .update(schema.subscriptions)
      .set(updateData)
      .where(eq(schema.subscriptions.id, subscriptionId))
      .returning();

    if (result.length === 0) {
      throw new Error("Subscription not found");
    }

    const sub = result[0];
    // Get tier info
    const tierResult = await db
      .select()
      .from(schema.subscriptionTiers)
      .where(eq(schema.subscriptionTiers.id, sub.tierId))
      .limit(1);

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
      updatedAt: sub.updatedAt,
    };
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, id), eq(schema.users.isDeleted, false)))
      .limit(1);

    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.username, username), eq(schema.users.isDeleted, false)))
      .limit(1);

    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(insertUser).returning();
    return result[0];
  }

  async updateUserFacebookPersonalToken(userId: number, token: string): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({ facebookPersonalToken: token, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserFacebookPageToken(
    userId: number,
    token: string,
    pageId: string
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        facebookPageToken: token,
        facebookPageId: pageId,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserInstagramToken(
    userId: number,
    token: string,
    userProfile: any,
    instagramBusinessAccountId: string
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        instagramToken: token,
        instagramUserProfile: userProfile,
        instagramBusinessAccountId: instagramBusinessAccountId,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserWhatsAppToken(
    userId: number,
    token: string,
    whatsappBusinessAccountId: string,
    phoneNumberId: string,
    userProfile: any
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        whatsappToken: token,
        whatsappBusinessAccountId: whatsappBusinessAccountId,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappUserProfile: userProfile,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserLinkedInToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        linkedinToken: token,
        linkedinUserProfile: userProfile,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserLinkedInPageToken(
    userId: number,
    token: string,
    pageUrn: any
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        linkedinPageToken: token,
        linkedinPageUrn: pageUrn,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserTwitterToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        twitterToken: token,
        twitterUserProfile: userProfile,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserYouTubeToken(
    userId: number,
    token: string,
    refreshToken: string,
    channelId: string,
    userProfile: any
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        youtubeToken: token,
        youtubeRefreshToken: refreshToken,
        youtubeChannelId: channelId,
        youtubeUserProfile: userProfile,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserTikTokToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        tiktokToken: token,
        tiktokUserProfile: userProfile,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserPinterestToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        pinterestToken: token,
        pinterestUserProfile: userProfile,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserSnapchatToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        snapchatToken: token,
        snapchatUserProfile: userProfile,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.isDeleted, false));
  }

  async deleteUser(userId: number): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  // Post methods
  async createPost(userId: number, insertPost: InsertPost): Promise<Post> {
    const result = await db
      .insert(schema.posts)
      .values({
        ...insertPost,
        userId,
        status: insertPost.status || (insertPost.scheduledTime ? "scheduled" : "draft"),
      })
      .returning();

    return result[0];
  }

  async getUserPosts(
    userId: number,
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<Post[]> {
    const conditions = [
      eq(schema.posts.userId, userId),
      eq(schema.posts.isDeleted, false)
    ];

    if (status) {
      conditions.push(eq(schema.posts.status, status));
    }

    return await db
      .select()
      .from(schema.posts)
      .where(and(...conditions))
      .orderBy(desc(schema.posts.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
  }

  async updatePost(postId: number, updates: Partial<Post>): Promise<Post> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    const result = await db
      .update(schema.posts)
      .set(updateData)
      .where(eq(schema.posts.id, postId))
      .returning();

    if (result.length === 0) throw new Error("Post not found");
    return result[0];
  }

  async getScheduledPosts(userId: number): Promise<Post[]> {
    return await db
      .select()
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.userId, userId),
          eq(schema.posts.status, "scheduled"),
          eq(schema.posts.isDeleted, false)
        )
      );
  }

  async updatePostStatus(postId: number, status: string): Promise<Post> {
    const result = await db
      .update(schema.posts)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.posts.id, postId))
      .returning();

    if (result.length === 0) throw new Error("Post not found");
    return result[0];
  }

  async updatePostAnalytics(postId: number, analytics: any): Promise<Post> {
    const result = await db
      .update(schema.posts)
      .set({ analytics, updatedAt: new Date() })
      .where(eq(schema.posts.id, postId))
      .returning();

    if (result.length === 0) throw new Error("Post not found");
    return result[0];
  }

  async deletePost(postId: number): Promise<Post> {
    const result = await db
      .update(schema.posts)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.posts.id, postId))
      .returning();

    if (result.length === 0) throw new Error("Post not found");
    return result[0];
  }

  async getPost(postId: number): Promise<Post | undefined> {
    const result = await db
      .select()
      .from(schema.posts)
      .where(and(eq(schema.posts.id, postId), eq(schema.posts.isDeleted, false)))
      .limit(1);

    return result[0];
  }

  async getAllPosts(): Promise<Post[]> {
    return await db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.isDeleted, false))
      .orderBy(desc(schema.posts.createdAt));
  }

  async clearAllPosts(): Promise<void> {
    await db.delete(schema.posts);
  }

  // Quota and payment methods
  async getUserPostCount(userId: number, month: number): Promise<number> {
    const startOfMonth = new Date(new Date().getFullYear(), month, 1);
    const endOfMonth = new Date(new Date().getFullYear(), month + 1, 0, 23, 59, 59);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.userId, userId),
          eq(schema.posts.countedForQuota, true),
          eq(schema.posts.isDeleted, false),
          gte(schema.posts.createdAt, startOfMonth),
          lte(schema.posts.createdAt, endOfMonth)
        )
      );

    return Number(result[0]?.count || 0);
  }

  async getUserPlatformPostsLastHour(userId: number, platform: string): Promise<number> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.userId, userId),
          eq(schema.posts.isDeleted, false),
          gte(schema.posts.createdAt, oneHourAgo),
          lte(schema.posts.createdAt, now),
          sql`${schema.posts.platforms}::jsonb @> ${JSON.stringify([platform])}::jsonb`
        )
      );

    return Number(result[0]?.count || 0);
  }

  async updateUserStripeId(userId: number, stripeId: string): Promise<void> {
    await db
      .update(schema.users)
      .set({ stripeCustomerId: stripeId, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  async getUserPackage(userId: number): Promise<{ tier: string } | null> {
    const subscription = await this.getUserSubscription(userId);
    return subscription ? { tier: subscription.plan } : null;
  }

  async updateUserSubscription(
    userId: number,
    tier: string,
    postsUsed: number,
    periodEnd: Date
  ): Promise<void> {
    const existingSub = await this.getUserSubscription(userId);
    if (existingSub) {
      await this.updateSubscription(existingSub.id, {
        postsUsed,
        periodEnd: periodEnd.getTime(),
      });
    } else {
      // Find tier ID
      const tierResult = await db
        .select()
        .from(schema.subscriptionTiers)
        .where(eq(schema.subscriptionTiers.name, tier))
        .limit(1);

      if (tierResult.length === 0) {
        throw new Error(`Tier "${tier}" not found`);
      }

      await db.insert(schema.subscriptions).values({
        userId,
        tierId: tierResult[0].id,
        stripeSubscriptionId: `temp_${userId}_${Date.now()}`,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        postsUsed,
      });
    }
  }
}

