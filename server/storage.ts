import { User, InsertUser, Post, InsertPost, SocialAccount, type AccessRequest } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Define the missing Subscription types
export interface Subscription {
  id: number;
  userId: number;
  plan: string;
  status: string;
  postsUsed: number;
  postsLimit: number;
  periodStart: number;
  periodEnd: number;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertSubscription {
  userId: number;
  plan: string;
  status: string;
  postsUsed: number;
  postsLimit: number;
  periodStart: number;
  periodEnd: number;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface IStorage {
  sessionStore: session.Store;

  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>;
  getUserSubscription(userId: number): Promise<Subscription | null>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(
    subscriptionId: number, 
    updates: Partial<Subscription>
  ): Promise<Subscription>;
  updateUserSubscription(
    userId: number,
    tier: string,
    postsUsed: number,
    periodEnd: Date
  ): Promise<void>;

  getUserPostCount(userId: number, month: number): Promise<number>;
  getUserPlatformPostsLastHour(userId: number, platform: string): Promise<number>;
  updateUserStripeId(userId: number, stripeId: string): Promise<void>;
  updateUserPackageTier(userId: number, packageTier: "basic" | "advance"): Promise<void>;
  /** When an Advance Stripe subscription ends, move linked users back to Basic. */
  downgradeAdvancePackageForStripeCustomer(stripeCustomerId: string): Promise<void>;
  getUserPackage(userId: number): Promise<{ tier: string } | null>;
  updatePost(postId: number, updates: Partial<Post>): Promise<Post>;


  // User-related methods
 getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  updateUserFacebookPersonalToken(userId: number, token: string): Promise<User>;
  updateUserFacebookPageToken(
    userId: number,
    token: string,
    pageId: string
  ): Promise<User>;

  updateUserInstagramToken(
    userId: number,
    token: string,
    userProfile: any,
    instagramBusinessAccountId: string
  ): Promise<User>;

  updateUserWhatsAppToken(
    userId: number,
    token: string,
    whatsappBusinessAccountId: string,
    phoneNumberId: string,
    userProfile: any
  ): Promise<User>;

  updateUserLinkedInToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User>;
  updateUserLinkedInPageToken(
    userId: number,
    token: string,
    pageUrn: any
  ): Promise<User>;

  updateUserTwitterToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User>;

  updateUserYouTubeToken(
    userId: number,
    token: string,
    refreshToken: string,
    channelId: string,
    userProfile: any
  ): Promise<User>;

  updateUserTikTokToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User>;

  updateUserPinterestToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User>;

  updateUserSnapchatToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User>;

  updateUserOpenRouterApiKey(userId: number, apiKey: string | null): Promise<User>;

  createAccessRequest(data: {
    email: string;
    fullName: string;
    company?: string | null;
    message?: string | null;
    packageTierRequested: "basic" | "advance";
  }): Promise<AccessRequest>;

  listAccessRequests(status?: string): Promise<AccessRequest[]>;

  getAccessRequest(id: number): Promise<AccessRequest | undefined>;

  updateAccessRequest(
    id: number,
    data: { status: string; approvedUserId?: number | null }
  ): Promise<AccessRequest>;

  getAllUsers(): Promise<User[]>;

  getUserByTelegramChatId(telegramChatId: string): Promise<User | undefined>;
  setUserTelegramChatId(userId: number, telegramChatId: string | null): Promise<User>;
  listSocialAccounts(userId: number): Promise<SocialAccount[]>;
  upsertFacebookPageSocialAccount(
    userId: number,
    pageId: string,
    accessToken: string,
    displayName: string
  ): Promise<void>;
  deleteSocialAccount(userId: number, accountId: number): Promise<void>;
  setDefaultSocialAccount(userId: number, accountId: number): Promise<void>;
  getEffectiveFacebookPageCredentials(
    userId: number
  ): Promise<{ pageToken: string; pageId: string } | null>;

  // Post-related methods
  createPost(userId: number, post: InsertPost): Promise<Post>;
  getUserPosts(
    userId: number,
    page?: number,
    limit?: number,
    status?: string
  ): Promise<Post[]>;
  getScheduledPosts(userId: number): Promise<Post[]>;
  updatePostStatus(postId: number, status: string): Promise<Post>;
  updatePostAnalytics(postId: number, analytics: any): Promise<Post>;
  deletePost(postId: number): Promise<Post>;
  getPost(postId: number): Promise<Post | undefined>;
  getAllPosts(): Promise<Post[]>;
  clearAllPosts(): Promise<void>;
  deleteUser(userId: number): Promise<User>;
}


export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private posts: Map<number, Post>;
  private currentUserId: number;
  private currentPostId: number;
  private subscriptions: Map<number, Subscription>;
  private subscriptionIdCounter: number;
  private postCounts: Map<string, number>;
  private socialAccounts: SocialAccount[] = [];
  private socialAccountIdCounter = 1;
  private accessRequests: AccessRequest[] = [];
  private accessRequestIdCounter = 1;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.posts = new Map();
    this.subscriptions = new Map();
    this.subscriptionIdCounter = 1;
    this.postCounts = new Map();
    this.socialAccounts = [];
    this.socialAccountIdCounter = 1;
    this.currentUserId = 1;
    this.currentPostId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 1 day
    });
  }

  // Helper method to validate user existence
  private async validateUser(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    return user;
  }

  // Helper method to validate post existence
  private async validatePost(postId: number): Promise<Post> {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error(`Post with ID ${postId} not found`);
    }
    return post;
  }

  // Subscription methods
  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    for (const sub of Array.from(this.subscriptions.values())) {
      if (sub.stripeSubscriptionId === stripeSubscriptionId) {
        return sub;
      }
    }
    return null;
  }

  async getUserSubscription(userId: number): Promise<Subscription | null> {
    for (const sub of Array.from(this.subscriptions.values())) {
      if (sub.userId === userId) {
        return sub;
      }
    }
    return null;
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const id = this.subscriptionIdCounter++;
    const newSubscription: Subscription = {
      ...subscription,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.subscriptions.set(id, newSubscription);
    return newSubscription;
  }

  async updateSubscription(
    subscriptionId: number, 
    updates: Partial<Subscription>
  ): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }
    const updated = { ...subscription, ...updates, updatedAt: new Date() };
    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const id = this.currentUserId++;
    const user: User = {
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
      youtubeRefreshToken: null,
      youtubeChannelId: null,
      youtubeUserProfile: null,
      tiktokToken: null,
      tiktokUserProfile: null,
      pinterestToken: null,
      pinterestUserProfile: null,
      snapchatToken: null,
      snapchatUserProfile: null,
      whatsappToken: null,
      whatsappBusinessAccountId: null,
      whatsappPhoneNumberId: null,
      whatsappUserProfile: null,
      telegramChatId: null,
      openrouterApiKey: null,
      isApproved: (insertUser as Partial<User>).isApproved ?? true,
      packageTier: (insertUser as Partial<User>).packageTier ?? "basic",
      stripeCustomerId: null,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      role: (insertUser as any).role || "user",
      permissions: (insertUser as any).permissions || [],
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserFacebookPersonalToken(
    userId: number,
    token: string
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = { ...user, facebookPersonalToken: token };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserFacebookPageToken(
    userId: number,
    token: string,
    pageId: string
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      facebookPageToken: token,
      facebookPageId: pageId,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserInstagramToken(
    userId: number,
    token: string,
    userProfile: any,
    instagramBusinessAccountId: string
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      instagramToken: token,
      instagramUserProfile: userProfile,
      instagramBusinessAccountId,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserWhatsAppToken(
    userId: number,
    token: string,
    whatsappBusinessAccountId: string,
    phoneNumberId: string,
    userProfile: any
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      whatsappToken: token,
      whatsappBusinessAccountId,
      whatsappPhoneNumberId: phoneNumberId,
      whatsappUserProfile: userProfile,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserLinkedInToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      linkedinToken: token,
      linkedinUserProfile: userProfile,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserLinkedInPageToken(
    userId: number,
    token: string,
    pageUrn: any
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      linkedinPageToken: token,
      linkedinPageUrn: pageUrn,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserTwitterToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      twitterToken: token,
      twitterUserProfile: userProfile,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserYouTubeToken(
    userId: number,
    token: string,
    refreshToken: string,
    channelId: string,
    userProfile: any
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      youtubeToken: token,
      youtubeRefreshToken: refreshToken,
      youtubeChannelId: channelId,
      youtubeUserProfile: userProfile,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserTikTokToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      tiktokToken: token,
      tiktokUserProfile: userProfile,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserPinterestToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      pinterestToken: token,
      pinterestUserProfile: userProfile,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserSnapchatToken(
    userId: number,
    token: string,
    userProfile: any
  ): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      snapchatToken: token,
      snapchatUserProfile: userProfile,
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserOpenRouterApiKey(userId: number, apiKey: string | null): Promise<User> {
    const user = await this.validateUser(userId);
    const updatedUser = {
      ...user,
      openrouterApiKey: apiKey,
      updatedAt: new Date(),
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async createAccessRequest(data: {
    email: string;
    fullName: string;
    company?: string | null;
    message?: string | null;
    packageTierRequested: "basic" | "advance";
  }): Promise<AccessRequest> {
    const now = new Date();
    const row: AccessRequest = {
      id: this.accessRequestIdCounter++,
      email: data.email,
      fullName: data.fullName,
      company: data.company ?? null,
      message: data.message ?? null,
      packageTierRequested: data.packageTierRequested,
      status: "pending",
      approvedUserId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.accessRequests.push(row);
    return row;
  }

  async listAccessRequests(status?: string): Promise<AccessRequest[]> {
    if (!status) return [...this.accessRequests].sort((a, b) => b.id - a.id);
    return this.accessRequests.filter((r) => r.status === status).sort((a, b) => b.id - a.id);
  }

  async getAccessRequest(id: number): Promise<AccessRequest | undefined> {
    return this.accessRequests.find((r) => r.id === id);
  }

  async updateAccessRequest(
    id: number,
    data: { status: string; approvedUserId?: number | null }
  ): Promise<AccessRequest> {
    const idx = this.accessRequests.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error("Access request not found");
    const prev = this.accessRequests[idx]!;
    const next: AccessRequest = {
      ...prev,
      status: data.status,
      approvedUserId:
        data.approvedUserId === undefined ? prev.approvedUserId : data.approvedUserId,
      updatedAt: new Date(),
    };
    this.accessRequests[idx] = next;
    return next;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUserByTelegramChatId(telegramChatId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (u) => u.telegramChatId && String(u.telegramChatId) === String(telegramChatId)
    );
  }

  async setUserTelegramChatId(userId: number, telegramChatId: string | null): Promise<User> {
    const user = await this.validateUser(userId);
    if (telegramChatId) {
      for (const [id, u] of Array.from(this.users.entries())) {
        if (u.telegramChatId === telegramChatId && id !== userId) {
          this.users.set(id, { ...u, telegramChatId: null });
        }
      }
    }
    const updated = { ...user, telegramChatId, updatedAt: new Date() };
    this.users.set(userId, updated);
    return updated;
  }

  async listSocialAccounts(userId: number): Promise<SocialAccount[]> {
    return this.socialAccounts.filter((a) => a.userId === userId);
  }

  async upsertFacebookPageSocialAccount(
    userId: number,
    pageId: string,
    accessToken: string,
    displayName: string
  ): Promise<void> {
    const platform = "facebook-page";
    const now = new Date();
    for (const a of this.socialAccounts) {
      if (a.userId === userId && a.platform === platform) {
        a.isDefault = false;
        a.updatedAt = now;
      }
    }
    const existing = this.socialAccounts.find(
      (a) => a.userId === userId && a.platform === platform && a.externalId === pageId
    );
    if (existing) {
      existing.accessToken = accessToken;
      existing.displayName = displayName;
      existing.isDefault = true;
      existing.updatedAt = now;
      return;
    }
    this.socialAccounts.push({
      id: this.socialAccountIdCounter++,
      userId,
      platform,
      displayName,
      externalId: pageId,
      accessToken,
      refreshToken: null,
      metadata: {},
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  async deleteSocialAccount(userId: number, accountId: number): Promise<void> {
    const idx = this.socialAccounts.findIndex((a) => a.id === accountId && a.userId === userId);
    if (idx === -1) throw new Error("Social account not found");
    this.socialAccounts.splice(idx, 1);
  }

  async setDefaultSocialAccount(userId: number, accountId: number): Promise<void> {
    const acc = this.socialAccounts.find((a) => a.id === accountId && a.userId === userId);
    if (!acc) throw new Error("Social account not found");
    const now = new Date();
    this.socialAccounts.forEach((a) => {
      if (a.userId === userId && a.platform === acc.platform) {
        a.isDefault = a.id === accountId;
        a.updatedAt = now;
      }
    });
  }

  async getEffectiveFacebookPageCredentials(
    userId: number
  ): Promise<{ pageToken: string; pageId: string } | null> {
    const def = this.socialAccounts.find(
      (a) => a.userId === userId && a.platform === "facebook-page" && a.isDefault
    );
    if (def?.accessToken && def.externalId) {
      return { pageToken: def.accessToken, pageId: def.externalId };
    }
    const user = await this.getUser(userId);
    if (user?.facebookPageToken && user.facebookPageId) {
      return { pageToken: user.facebookPageToken, pageId: user.facebookPageId };
    }
    return null;
  }

  async deleteUser(userId: number): Promise<User> {
    const user = await this.validateUser(userId);
    this.users.delete(userId);
    return user;
  }

  // Post methods
async createPost(userId: number, insertPost: InsertPost): Promise<Post> {
  const id = this.currentPostId++;
  const post: Post = {
    ...insertPost,
    id,
    userId,
    status: insertPost.status || (insertPost.scheduledTime ? "scheduled" : "draft"),
    analytics: insertPost.analytics || {},
    createdAt: new Date(),
    updatedAt: new Date(),
    timezone: insertPost.timezone || "UTC",
    scheduledTime: insertPost.scheduledTime ?? null,
    platforms: insertPost.platforms ?? [],
    mediaUrls: insertPost.mediaUrls ?? [],
    mediaType: insertPost.mediaType ?? null,
    contentOverrides: insertPost.contentOverrides ?? {},
    countedForQuota: insertPost.countedForQuota ?? false,
    isDeleted: false,  // Initialize soft delete fields
    deletedAt: null    // Initialize soft delete fields
  };
  this.posts.set(id, post);
  return post;
}
  async getUserPosts(
    userId: number,
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<Post[]> {
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

  async updatePost(postId: number, updates: Partial<Post>): Promise<Post> {
    const post = await this.validatePost(postId);
    const updatedPost = { 
      ...post, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.posts.set(postId, updatedPost);
    return updatedPost;
  }

  async countPostForQuota(postId: number) {
    const post = await this.getPost(postId);
    if (post && !post.countedForQuota) {
      await this.updatePost(postId, { countedForQuota: true });
    }
  }

  async getScheduledPosts(userId: number): Promise<Post[]> {
    return Array.from(this.posts.values()).filter(
      (post) => post.userId === userId && post.status === "scheduled"
    );
  }

  async updatePostStatus(postId: number, status: string): Promise<Post> {
    const post = await this.validatePost(postId);
    const updatedPost = { ...post, status, updatedAt: new Date() };
    this.posts.set(postId, updatedPost);
    return updatedPost;
  }

  async updatePostAnalytics(postId: number, analytics: any): Promise<Post> {
    const post = await this.validatePost(postId);
    const updatedPost = { ...post, analytics, updatedAt: new Date() };
    this.posts.set(postId, updatedPost);
    return updatedPost;
  }

  async deletePost(postId: number): Promise<Post> {
    const post = await this.validatePost(postId);
    this.posts.delete(postId);
    return post;
  }

  async getPost(postId: number): Promise<Post | undefined> {
    try {
      return await this.validatePost(postId);
    } catch {
      return undefined;
    }
  }

  async getAllPosts(): Promise<Post[]> {
    return Array.from(this.posts.values());
  }

  async clearAllPosts(): Promise<void> {
    this.posts.clear();
  }

  // Quota and payment methods
  async getUserPostCount(userId: number, month: number): Promise<number> {
    return Array.from(this.posts.values()).filter(post => {
      if (post.userId !== userId) return false;
      const postMonth = post.createdAt?.getMonth() || new Date().getMonth();
      return postMonth === month;
    }).length;
  }

  async getUserPlatformPostsLastHour(userId: number, platform: string): Promise<number> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    return Array.from(this.posts.values()).filter(post => {
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
      ] as const;
      
      const postPlatforms = Array.isArray(post.platforms) 
        ? post.platforms.filter(p => validPlatforms.includes(p as any))
        : [];
      
      if (!postPlatforms.includes(platform as any)) return false;
      
      const postTime = post.createdAt || new Date();
      return postTime >= oneHourAgo && postTime <= now;
    }).length;
  }

  async updateUserStripeId(userId: number, stripeId: string): Promise<void> {
    const user = await this.validateUser(userId);
    this.users.set(userId, { ...user, stripeCustomerId: stripeId });
  }

  async updateUserPackageTier(userId: number, packageTier: "basic" | "advance"): Promise<void> {
    const user = await this.validateUser(userId);
    this.users.set(userId, { ...user, packageTier, updatedAt: new Date() });
  }

  async downgradeAdvancePackageForStripeCustomer(stripeCustomerId: string): Promise<void> {
    for (const [id, user] of this.users.entries()) {
      if (user.stripeCustomerId === stripeCustomerId && user.packageTier === "advance") {
        this.users.set(id, { ...user, packageTier: "basic", updatedAt: new Date() });
      }
    }
  }

  async getUserPackage(userId: number): Promise<{ tier: string } | null> {
    const subscription = await this.getUserSubscription(userId);
    return subscription ? { tier: subscription.plan } : null;
  }

  // Additional helper method for subscription management
  async updateUserSubscription(
    userId: number,
    tier: string,
    postsUsed: number,
    periodEnd: Date
  ): Promise<void> {
    const existingSub = await this.getUserSubscription(userId);
    if (existingSub) {
      await this.updateSubscription(existingSub.id, {
        plan: tier,
        postsUsed,
        periodEnd: Math.floor(periodEnd.getTime() / 1000)
      });
    } else {
      await this.createSubscription({
        userId,
        plan: tier,
        status: 'active',
        postsUsed,
        postsLimit: 0, // Set appropriate limit
        periodStart: Math.floor(Date.now() / 1000),
        periodEnd: Math.floor(periodEnd.getTime() / 1000),
        stripeSubscriptionId: '',
        stripeCustomerId: '',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
}

// Import DbStorage at the top (ES module)
import { DbStorage } from "./db-storage";

// Initialize storage based on environment
function initializeStorage(): IStorage {
  if (process.env.DATABASE_URL) {
    try {
      const dbStorage = new DbStorage();
      console.log("✅ Using database storage");
      return dbStorage;
    } catch (error) {
      console.error("❌ Failed to initialize database storage, falling back to memory:", error);
      return new MemStorage();
    }
  } else {
    console.warn("⚠️  DATABASE_URL not set, using in-memory storage (data will be lost on restart)");
    return new MemStorage();
  }
}

export const storage = initializeStorage();