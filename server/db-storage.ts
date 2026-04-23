import { eq, and, desc, sql, gte, lte, or, ne } from "drizzle-orm";
import { db, schema } from "./db";
import { IStorage, Subscription, InsertSubscription } from "./storage";
import {
  User,
  InsertUser,
  Post,
  InsertPost,
  SocialAccount,
  type AccessRequest,
  type Company,
  type CompanyMembership,
  type AgentChannelUser,
} from "@shared/schema";
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

  async updateUserProfile(userId: number, updates: { username: string; email: string }): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        username: updates.username,
        email: updates.email,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.users.id, userId), eq(schema.users.isDeleted, false)))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async updateUserPasswordHash(userId: number, passwordHash: string): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        password: passwordHash,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.users.id, userId), eq(schema.users.isDeleted, false)))
      .returning();

    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async getUserCompanyContext(userId: number): Promise<{ company: Company; membership: CompanyMembership } | null> {
    const row = await db
      .select({
        company: schema.companies,
        membership: schema.companyMemberships,
      })
      .from(schema.companyMemberships)
      .innerJoin(schema.companies, eq(schema.companyMemberships.companyId, schema.companies.id))
      .where(
        and(
          eq(schema.companyMemberships.userId, userId),
          eq(schema.companyMemberships.isActive, true),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${schema.companyMemberships.role} = 'owner' THEN 0 ELSE 1 END`,
        desc(schema.companyMemberships.id),
      )
      .limit(1);

    if (row.length === 0) return null;
    return { company: row[0].company, membership: row[0].membership };
  }

  async setCompanyMembershipControls(
    companyId: number,
    targetUserId: number,
    actorUserId: number,
    updates: {
      aiEnabled?: boolean;
      allowedPlatforms?: string[];
      role?: "owner" | "moderator";
      isActive?: boolean;
    }
  ): Promise<CompanyMembership> {
    const existing = await db
      .select()
      .from(schema.companyMemberships)
      .where(
        and(
          eq(schema.companyMemberships.companyId, companyId),
          eq(schema.companyMemberships.userId, targetUserId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Membership not found");
    }

    const prev = existing[0];
    const nextValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (updates.aiEnabled !== undefined) nextValues.aiEnabled = updates.aiEnabled;
    if (updates.allowedPlatforms !== undefined) nextValues.allowedPlatforms = updates.allowedPlatforms;
    if (updates.role !== undefined) nextValues.role = updates.role;
    if (updates.isActive !== undefined) nextValues.isActive = updates.isActive;

    const changed = await db
      .update(schema.companyMemberships)
      .set(nextValues)
      .where(eq(schema.companyMemberships.id, prev.id))
      .returning();
    if (changed.length === 0) throw new Error("Failed to update membership");

    await db.insert(schema.auditLogs).values({
      companyId,
      changedByUserId: actorUserId,
      targetUserId,
      action: "membership_controls_updated",
      oldValue: {
        role: prev.role,
        aiEnabled: prev.aiEnabled,
        allowedPlatforms: prev.allowedPlatforms,
        isActive: prev.isActive,
      },
      newValue: {
        role: changed[0].role,
        aiEnabled: changed[0].aiEnabled,
        allowedPlatforms: changed[0].allowedPlatforms,
        isActive: changed[0].isActive,
      },
    });

    return changed[0];
  }

  async getUserByAgentChannelIdentity(
    channel: "telegram" | "whatsapp",
    channelUserId: string
  ): Promise<User | undefined> {
    const rows = await db
      .select({ user: schema.users })
      .from(schema.agentChannelUsers)
      .innerJoin(schema.users, eq(schema.agentChannelUsers.userId, schema.users.id))
      .where(
        and(
          eq(schema.agentChannelUsers.channel, channel),
          eq(schema.agentChannelUsers.channelUserId, channelUserId),
          eq(schema.agentChannelUsers.isActive, true),
          eq(schema.users.isDeleted, false),
        ),
      )
      .limit(1);
    return rows[0]?.user;
  }

  async upsertAgentChannelUserLink(params: {
    companyId: number;
    userId: number;
    channel: "telegram" | "whatsapp";
    channelUserId: string;
    isActive?: boolean;
  }): Promise<AgentChannelUser> {
    const active = params.isActive ?? true;
    const existingByChannelIdentity = await db
      .select()
      .from(schema.agentChannelUsers)
      .where(
        and(
          eq(schema.agentChannelUsers.channel, params.channel),
          eq(schema.agentChannelUsers.channelUserId, params.channelUserId),
        ),
      )
      .limit(1);
    if (existingByChannelIdentity.length > 0) {
      const updated = await db
        .update(schema.agentChannelUsers)
        .set({
          companyId: params.companyId,
          userId: params.userId,
          isActive: active,
          updatedAt: new Date(),
        })
        .where(eq(schema.agentChannelUsers.id, existingByChannelIdentity[0].id))
        .returning();
      return updated[0];
    }

    const existingByUserChannel = await db
      .select()
      .from(schema.agentChannelUsers)
      .where(
        and(
          eq(schema.agentChannelUsers.companyId, params.companyId),
          eq(schema.agentChannelUsers.userId, params.userId),
          eq(schema.agentChannelUsers.channel, params.channel),
        ),
      )
      .limit(1);
    if (existingByUserChannel.length > 0) {
      const updated = await db
        .update(schema.agentChannelUsers)
        .set({
          channelUserId: params.channelUserId,
          isActive: active,
          updatedAt: new Date(),
        })
        .where(eq(schema.agentChannelUsers.id, existingByUserChannel[0].id))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(schema.agentChannelUsers)
      .values({
        companyId: params.companyId,
        userId: params.userId,
        channel: params.channel,
        channelUserId: params.channelUserId,
        isActive: active,
      })
      .returning();
    return inserted[0];
  }

  async listCompanyAgentChannelUsers(companyId: number): Promise<Array<{
    id: number;
    channel: string;
    channelUserId: string;
    isActive: boolean;
    userId: number;
    username: string;
    email: string;
    updatedAt: Date;
  }>> {
    return db
      .select({
        id: schema.agentChannelUsers.id,
        channel: schema.agentChannelUsers.channel,
        channelUserId: schema.agentChannelUsers.channelUserId,
        isActive: schema.agentChannelUsers.isActive,
        userId: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        updatedAt: schema.agentChannelUsers.updatedAt,
      })
      .from(schema.agentChannelUsers)
      .innerJoin(schema.users, eq(schema.agentChannelUsers.userId, schema.users.id))
      .where(eq(schema.agentChannelUsers.companyId, companyId))
      .orderBy(desc(schema.agentChannelUsers.updatedAt));
  }

  async getAgentChannelUserById(id: number): Promise<AgentChannelUser | undefined> {
    const rows = await db
      .select()
      .from(schema.agentChannelUsers)
      .where(eq(schema.agentChannelUsers.id, id))
      .limit(1);
    return rows[0];
  }

  async updateAgentChannelUserActive(id: number, isActive: boolean): Promise<AgentChannelUser> {
    const rows = await db
      .update(schema.agentChannelUsers)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.agentChannelUsers.id, id))
      .returning();
    if (rows.length === 0) {
      throw new Error("Channel mapping not found");
    }
    return rows[0];
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

  async updateUserOpenRouterApiKey(userId: number, apiKey: string | null): Promise<User> {
    const result = await db
      .update(schema.users)
      .set({
        openrouterApiKey: apiKey,
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

  async getUserByTelegramChatId(telegramChatId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.telegramChatId, telegramChatId), eq(schema.users.isDeleted, false)))
      .limit(1);
    return result[0];
  }

  async setUserTelegramChatId(userId: number, telegramChatId: string | null): Promise<User> {
    if (telegramChatId) {
      await db
        .update(schema.users)
        .set({ telegramChatId: null, updatedAt: new Date() })
        .where(and(eq(schema.users.telegramChatId, telegramChatId), ne(schema.users.id, userId)));
    }
    const result = await db
      .update(schema.users)
      .set({ telegramChatId, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();
    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async listSocialAccounts(userId: number): Promise<SocialAccount[]> {
    return await db
      .select()
      .from(schema.socialAccounts)
      .where(eq(schema.socialAccounts.userId, userId))
      .orderBy(desc(schema.socialAccounts.updatedAt));
  }

  async upsertFacebookPageSocialAccount(
    userId: number,
    pageId: string,
    accessToken: string,
    displayName: string
  ): Promise<void> {
    const platform = "facebook-page";
    const now = new Date();
    await db
      .update(schema.socialAccounts)
      .set({ isDefault: false, updatedAt: now })
      .where(and(eq(schema.socialAccounts.userId, userId), eq(schema.socialAccounts.platform, platform)));

    const existing = await db
      .select()
      .from(schema.socialAccounts)
      .where(
        and(
          eq(schema.socialAccounts.userId, userId),
          eq(schema.socialAccounts.platform, platform),
          eq(schema.socialAccounts.externalId, pageId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.socialAccounts)
        .set({
          accessToken,
          displayName,
          isDefault: true,
          updatedAt: now,
        })
        .where(eq(schema.socialAccounts.id, existing[0].id));
      return;
    }

    await db.insert(schema.socialAccounts).values({
      userId,
      platform,
      displayName,
      externalId: pageId,
      accessToken,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  async deleteSocialAccount(userId: number, accountId: number): Promise<void> {
    const result = await db
      .delete(schema.socialAccounts)
      .where(and(eq(schema.socialAccounts.id, accountId), eq(schema.socialAccounts.userId, userId)))
      .returning();
    if (result.length === 0) throw new Error("Social account not found");
  }

  async setDefaultSocialAccount(userId: number, accountId: number): Promise<void> {
    const rows = await db
      .select()
      .from(schema.socialAccounts)
      .where(and(eq(schema.socialAccounts.id, accountId), eq(schema.socialAccounts.userId, userId)))
      .limit(1);
    if (!rows.length) throw new Error("Social account not found");
    const platform = rows[0].platform;
    const now = new Date();
    await db
      .update(schema.socialAccounts)
      .set({ isDefault: false, updatedAt: now })
      .where(and(eq(schema.socialAccounts.userId, userId), eq(schema.socialAccounts.platform, platform)));
    await db
      .update(schema.socialAccounts)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(schema.socialAccounts.id, accountId));
  }

  async getEffectiveFacebookPageCredentials(
    userId: number
  ): Promise<{ pageToken: string; pageId: string } | null> {
    const def = await db
      .select()
      .from(schema.socialAccounts)
      .where(
        and(
          eq(schema.socialAccounts.userId, userId),
          eq(schema.socialAccounts.platform, "facebook-page"),
          eq(schema.socialAccounts.isDefault, true)
        )
      )
      .limit(1);
    if (def[0]?.accessToken && def[0].externalId) {
      return { pageToken: def[0].accessToken, pageId: def[0].externalId };
    }
    const user = await this.getUser(userId);
    if (user?.facebookPageToken && user.facebookPageId) {
      return { pageToken: user.facebookPageToken, pageId: user.facebookPageId };
    }
    return null;
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
        contentOverrides: insertPost.contentOverrides ?? {},
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

  async updateUserPackageTier(userId: number, packageTier: "basic" | "advance"): Promise<void> {
    await db
      .update(schema.users)
      .set({ packageTier, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  async downgradeAdvancePackageForStripeCustomer(stripeCustomerId: string): Promise<void> {
    await db
      .update(schema.users)
      .set({ packageTier: "basic", updatedAt: new Date() })
      .where(
        and(eq(schema.users.stripeCustomerId, stripeCustomerId), eq(schema.users.packageTier, "advance"))
      );
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

  async createAccessRequest(data: {
    email: string;
    fullName: string;
    company?: string | null;
    message?: string | null;
    deviceHash?: string | null;
    packageTierRequested: "basic" | "advance";
  }): Promise<AccessRequest> {
    const [row] = await db
      .insert(schema.accessRequests)
      .values({
        email: data.email,
        fullName: data.fullName,
        company: data.company ?? null,
        message: data.message ?? null,
        deviceHash: data.deviceHash ?? null,
        packageTierRequested: data.packageTierRequested,
      })
      .returning();
    return row;
  }

  async countApprovedAccessRequestsByDeviceHash(deviceHash: string): Promise<number> {
    if (!deviceHash) return 0;
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.accessRequests)
      .where(and(eq(schema.accessRequests.deviceHash, deviceHash), eq(schema.accessRequests.status, "approved")));
    return Number(rows[0]?.count || 0);
  }

  async listAccessRequests(status?: string): Promise<AccessRequest[]> {
    if (status) {
      return db
        .select()
        .from(schema.accessRequests)
        .where(eq(schema.accessRequests.status, status))
        .orderBy(desc(schema.accessRequests.createdAt));
    }
    return db
      .select()
      .from(schema.accessRequests)
      .orderBy(desc(schema.accessRequests.createdAt));
  }

  async getAccessRequest(id: number): Promise<AccessRequest | undefined> {
    const rows = await db
      .select()
      .from(schema.accessRequests)
      .where(eq(schema.accessRequests.id, id))
      .limit(1);
    return rows[0];
  }

  async updateAccessRequest(
    id: number,
    data: {
      status?: string;
      approvedUserId?: number | null;
      paymentStatus?: "pending" | "trialing" | "paid" | "failed";
      stripeCheckoutSessionId?: string | null;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      trialEndsAt?: Date | null;
      paidAt?: Date | null;
    }
  ): Promise<AccessRequest> {
    const patch: {
      status?: string;
      updatedAt: Date;
      approvedUserId?: number | null;
      paymentStatus?: "pending" | "trialing" | "paid" | "failed";
      stripeCheckoutSessionId?: string | null;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      trialEndsAt?: Date | null;
      paidAt?: Date | null;
    } = { updatedAt: new Date() };
    if (data.status !== undefined) patch.status = data.status;
    if (data.approvedUserId !== undefined) {
      patch.approvedUserId = data.approvedUserId;
    }
    if (data.paymentStatus !== undefined) patch.paymentStatus = data.paymentStatus;
    if (data.stripeCheckoutSessionId !== undefined) patch.stripeCheckoutSessionId = data.stripeCheckoutSessionId;
    if (data.stripeCustomerId !== undefined) patch.stripeCustomerId = data.stripeCustomerId;
    if (data.stripeSubscriptionId !== undefined) patch.stripeSubscriptionId = data.stripeSubscriptionId;
    if (data.trialEndsAt !== undefined) patch.trialEndsAt = data.trialEndsAt;
    if (data.paidAt !== undefined) patch.paidAt = data.paidAt;
    const [row] = await db
      .update(schema.accessRequests)
      .set(patch)
      .where(eq(schema.accessRequests.id, id))
      .returning();
    if (!row) throw new Error("Access request not found");
    return row;
  }
}

