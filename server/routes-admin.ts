/**
 * Admin API Routes
 * 
 * All admin-related endpoints with role-based access control
 */

import { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { db, schema } from "./db";
import { eq, and, desc, count, sql, inArray } from "drizzle-orm";
import { requireAdmin, requirePermission, requireAnyPermission } from "./middleware/rbac";
import { 
  getAllFeatureFlags, 
  updateFeatureFlag, 
  FEATURE_KEYS 
} from "./feature-config";
import {
  ROLE_CONFIG,
  getUserPermissions,
  getAvailableFeatures,
  getAssignableRoles,
  type UserRole,
} from "./admin-config";
import { hashPassword } from "./auth";
import { sanitizeUserForClient } from "./sanitize-user";
import {
  getSuperAdminNotifyEmailSource,
  setSuperAdminNotifyEmail,
} from "./notification-config";
import { isSmtpConfigured, sendSmtpMail } from "./smtp-send";
import { platformEnum } from "@shared/schema";
import { maskOpenRouterApiKeyHint, normalizeOpenRouterApiKey } from "./openrouter-headers";

type CompanyRole = "owner" | "moderator";
const COMPANY_ROLE_ORDER: Record<CompanyRole, number> = {
  moderator: 1,
  owner: 2,
};

function normalizeCompanyRole(raw: string | null | undefined): CompanyRole {
  if (raw === "owner" || raw === "moderator") return raw;
  return "moderator";
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Platform super admin access required",
    });
  }
  next();
}

function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
}

async function ensureDefaultCompanyModeratorMembership(userId: number): Promise<void> {
  const targetSlug = (process.env.DEFAULT_COMPANY_SLUG || "default-company").trim() || "default-company";
  const company = await db
    .select({ id: schema.companies.id })
    .from(schema.companies)
    .where(eq(schema.companies.slug, targetSlug))
    .limit(1);
  const companyId = company[0]?.id;
  if (!companyId) return;

  await db
    .insert(schema.companyMemberships)
    .values({
      companyId,
      userId,
      role: "moderator",
      aiEnabled: true,
      allowedPlatforms: [],
      isActive: true,
    })
    .onConflictDoNothing();
}

async function notifyApprovedUser(options: {
  to: string;
  username: string;
  temporaryPassword: string;
  packageTier: "basic" | "advance";
}): Promise<boolean> {
  if (!isSmtpConfigured()) return false;
  const appName = process.env.OPENROUTER_APP_TITLE || "MultiSocial Studio";
  const baseUrl = (process.env.CLIENT_URL || process.env.BASE_URL || "http://localhost:9002").replace(/\/$/, "");
  const loginUrl = `${baseUrl}/auth`;
  await sendSmtpMail({
    to: options.to,
    subject: `[${appName}] Your access is approved`,
    text: [
      `Your account has been approved for ${appName}.`,
      ``,
      `Start here: ${loginUrl}`,
      `Username: ${options.username}`,
      `Temporary password: ${options.temporaryPassword}`,
      `Package: ${options.packageTier}`,
      ``,
      `After first login, open Integrations to add your own OpenRouter API key if you want AI features.`,
      `You can remove the key later at any time.`,
    ].join("\n"),
  });
  return true;
}

async function getCompanyAdminContext(req: Request, res: Response): Promise<{
  actorId: number;
  actorRole: CompanyRole;
  companyId: number;
} | null> {
  const actorId = req.user!.id;
  const actorCtx = await storage.getUserCompanyContext(actorId);
  if (!actorCtx) {
    res.status(404).json({ error: "No active company membership" });
    return null;
  }
  const actorRole = normalizeCompanyRole(actorCtx.membership.role);
  if (actorRole !== "owner") {
    res.status(403).json({ error: "Only company admins can access this section" });
    return null;
  }
  return { actorId, actorRole, companyId: actorCtx.company.id };
}

export function registerAdminRoutes(app: Express) {
  app.get(
    "/api/admin/company/members",
    requireAuthenticated,
    async (req, res) => {
      try {
        const ctx = await getCompanyAdminContext(req, res);
        if (!ctx) return;
        const actorCtx = await storage.getUserCompanyContext(ctx.actorId);
        if (!actorCtx) return res.status(404).json({ error: "No active company membership" });

        const members = await db
          .select({
            userId: schema.users.id,
            username: schema.users.username,
            email: schema.users.email,
            companyRole: schema.companyMemberships.role,
            aiEnabled: schema.companyMemberships.aiEnabled,
            allowedPlatforms: schema.companyMemberships.allowedPlatforms,
            membershipActive: schema.companyMemberships.isActive,
            packageTier: schema.users.packageTier,
            appRole: schema.users.role,
            isApproved: schema.users.isApproved,
          })
          .from(schema.companyMemberships)
          .innerJoin(schema.users, eq(schema.companyMemberships.userId, schema.users.id))
          .where(
            and(
              eq(schema.companyMemberships.companyId, actorCtx.company.id),
              eq(schema.users.isDeleted, false),
            ),
          )
          .orderBy(desc(schema.companyMemberships.id));

        res.json({
          company: {
            id: actorCtx.company.id,
            name: actorCtx.company.name,
            packageTier: actorCtx.company.packageTier,
          },
          actorMembership: actorCtx.membership,
          members,
        });
      } catch (error) {
        console.error("Error listing company members:", error);
        res.status(500).json({ error: "Failed to list company members" });
      }
    }
  );

  app.patch(
    "/api/admin/company/members/:userId",
    requireAuthenticated,
    async (req, res) => {
      try {
        const ctx = await getCompanyAdminContext(req, res);
        if (!ctx) return;
        const actorId = ctx.actorId;
        const targetUserId = parseInt(req.params.userId, 10);
        if (!Number.isFinite(targetUserId)) return res.status(400).json({ error: "Invalid userId" });

        const actorCtx = await storage.getUserCompanyContext(actorId);
        if (!actorCtx) return res.status(404).json({ error: "No active company membership" });
        const actorRole = normalizeCompanyRole(actorCtx.membership.role);
        if (actorRole === "moderator") {
          return res.status(403).json({ error: "Only company owners can manage members" });
        }

        const body = z
          .object({
            role: z.enum(["owner", "moderator"]).optional(),
            aiEnabled: z.boolean().optional(),
            allowedPlatforms: z.array(platformEnum).optional(),
            isActive: z.boolean().optional(),
          })
          .parse(req.body);

        const targetMembershipRows = await db
          .select()
          .from(schema.companyMemberships)
          .where(
            and(
              eq(schema.companyMemberships.companyId, actorCtx.company.id),
              eq(schema.companyMemberships.userId, targetUserId),
            ),
          )
          .limit(1);
        if (targetMembershipRows.length === 0) {
          return res.status(404).json({ error: "Target membership not found in your company" });
        }
        const targetMembership = targetMembershipRows[0];
        const targetRole = normalizeCompanyRole(targetMembership.role);

        // Company owners can manage moderators only.
        if (
          actorRole !== "owner" &&
          COMPANY_ROLE_ORDER[targetRole] >= COMPANY_ROLE_ORDER[actorRole]
        ) {
          return res.status(403).json({ error: "Cannot modify this member" });
        }
        if (
          body.role &&
          body.role !== targetMembership.role &&
          COMPANY_ROLE_ORDER[normalizeCompanyRole(body.role)] >= COMPANY_ROLE_ORDER[actorRole]
        ) {
          return res.status(403).json({ error: "Cannot assign a role equal or higher than yours" });
        }
        if (targetUserId === actorId && body.role && body.role !== actorRole) {
          return res.status(400).json({ error: "Cannot change your own company role here" });
        }
        if (targetUserId === actorId && body.isActive === false) {
          return res.status(400).json({ error: "You cannot deactivate your own company membership" });
        }

        const updated = await storage.setCompanyMembershipControls(
          actorCtx.company.id,
          targetUserId,
          actorId,
          body,
        );

        res.json({ membership: updated });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Error updating company member:", error);
        res.status(500).json({ error: "Failed to update member controls" });
      }
    }
  );

  app.put(
    "/api/admin/company/openrouter-key",
    requireAuthenticated,
    async (req, res) => {
      try {
        const ctx = await getCompanyAdminContext(req, res);
        if (!ctx) return;
        const actorId = ctx.actorId;
        const actorCtx = await storage.getUserCompanyContext(actorId);
        if (!actorCtx) return res.status(404).json({ error: "No active company membership" });

        const body = z
          .object({
            apiKey: z.string().min(16).max(512).optional(),
            clear: z.literal(true).optional(),
          })
          .strict()
          .parse(req.body);

        let newKey: string | null = actorCtx.company.openrouterApiKey ?? null;
        if (body.clear === true) newKey = null;
        if (body.apiKey !== undefined) {
          const normalized = normalizeOpenRouterApiKey(body.apiKey);
          if (!normalized) return res.status(400).json({ error: "API key is empty after trimming" });
          newKey = normalized;
        }

        await db
          .update(schema.companies)
          .set({
            openrouterApiKey: newKey,
            updatedAt: new Date(),
          })
          .where(eq(schema.companies.id, actorCtx.company.id));

        await db.insert(schema.auditLogs).values({
          companyId: actorCtx.company.id,
          changedByUserId: actorId,
          targetUserId: null,
          action: "company_openrouter_key_updated",
          oldValue: {
            hadKey: Boolean(actorCtx.company.openrouterApiKey),
          },
          newValue: {
            hadKey: Boolean(newKey),
          },
        });

        res.json({
          ok: true,
          hasKey: Boolean(newKey),
          maskedKey: newKey ? maskOpenRouterApiKeyHint(newKey) : null,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid request body" });
        }
        console.error("Error updating company OpenRouter key:", error);
        res.status(500).json({ error: "Failed to update company OpenRouter key" });
      }
    }
  );

  app.get(
    "/api/admin/company/channel-users",
    requireAuthenticated,
    async (req, res) => {
      try {
        const ctx = await getCompanyAdminContext(req, res);
        if (!ctx) return;
        const rows = await storage.listCompanyAgentChannelUsers(ctx.companyId);
        return res.json({
          companyId: ctx.companyId,
          items: rows,
        });
      } catch (error) {
        console.error("Error listing channel users:", error);
        return res.status(500).json({ error: "Failed to list channel users" });
      }
    }
  );

  app.patch(
    "/api/admin/company/channel-users/:id",
    requireAuthenticated,
    async (req, res) => {
      try {
        const ctx = await getCompanyAdminContext(req, res);
        if (!ctx) return;
        const mappingId = parseInt(req.params.id, 10);
        if (!Number.isFinite(mappingId)) {
          return res.status(400).json({ error: "Invalid mapping id" });
        }
        const body = z.object({ isActive: z.boolean() }).parse(req.body);
        const row = await storage.getAgentChannelUserById(mappingId);
        if (!row || row.companyId !== ctx.companyId) {
          return res.status(404).json({ error: "Channel mapping not found" });
        }
        const updated = await storage.updateAgentChannelUserActive(mappingId, body.isActive);
        await db.insert(schema.auditLogs).values({
          companyId: ctx.companyId,
          changedByUserId: ctx.actorId,
          targetUserId: row.userId,
          action: "channel_mapping_toggle",
          oldValue: { isActive: row.isActive, channel: row.channel, channelUserId: row.channelUserId },
          newValue: {
            isActive: updated.isActive,
            channel: updated.channel,
            channelUserId: updated.channelUserId,
          },
        });
        return res.json({ mapping: updated });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid request body" });
        }
        console.error("Error toggling channel mapping:", error);
        return res.status(500).json({ error: "Failed to toggle channel mapping" });
      }
    }
  );

  app.get(
    "/api/admin/super/companies-overview",
    requireSuperAdmin,
    async (_req, res) => {
      try {
        const companyRows = await db
          .select({
            id: schema.companies.id,
            name: schema.companies.name,
            slug: schema.companies.slug,
            packageTier: schema.companies.packageTier,
            ownerUserId: schema.companies.ownerUserId,
            hasCompanyKey: sql<boolean>`(${schema.companies.openrouterApiKey} is not null and ${schema.companies.openrouterApiKey} <> '')`,
            createdAt: schema.companies.createdAt,
            updatedAt: schema.companies.updatedAt,
            ownerUsername: schema.users.username,
            ownerEmail: schema.users.email,
            ownerApproved: schema.users.isApproved,
          })
          .from(schema.companies)
          .leftJoin(schema.users, eq(schema.companies.ownerUserId, schema.users.id))
          .orderBy(desc(schema.companies.createdAt));

        const companies = await Promise.all(
          companyRows.map(async (company) => {
            const members = await db
              .select({
                membershipId: schema.companyMemberships.id,
                userId: schema.users.id,
                username: schema.users.username,
                email: schema.users.email,
                appRole: schema.users.role,
                companyRole: schema.companyMemberships.role,
                aiEnabled: schema.companyMemberships.aiEnabled,
                membershipActive: schema.companyMemberships.isActive,
                allowedPlatforms: schema.companyMemberships.allowedPlatforms,
                isApproved: schema.users.isApproved,
                joinedAt: schema.companyMemberships.createdAt,
              })
              .from(schema.companyMemberships)
              .innerJoin(schema.users, eq(schema.companyMemberships.userId, schema.users.id))
              .where(
                and(
                  eq(schema.companyMemberships.companyId, company.id),
                  eq(schema.users.isDeleted, false),
                ),
              )
              .orderBy(desc(schema.companyMemberships.id));

            const postsResult = await db
              .select({
                totalPosts: sql<number>`count(*)`,
                publishedPosts: sql<number>`count(*) filter (where ${schema.posts.status} = 'published')`,
                scheduledPosts: sql<number>`count(*) filter (where ${schema.posts.status} = 'scheduled')`,
                draftPosts: sql<number>`count(*) filter (where ${schema.posts.status} = 'draft')`,
              })
              .from(schema.posts)
              .innerJoin(schema.companyMemberships, eq(schema.posts.userId, schema.companyMemberships.userId))
              .where(
                and(
                  eq(schema.companyMemberships.companyId, company.id),
                  eq(schema.posts.isDeleted, false),
                ),
              );

            const socialConnectionsResult = await db
              .select({
                totalConnections: sql<number>`count(*)`,
              })
              .from(schema.socialAccounts)
              .innerJoin(schema.companyMemberships, eq(schema.socialAccounts.userId, schema.companyMemberships.userId))
              .where(eq(schema.companyMemberships.companyId, company.id));

            const channelConnectionsResult = await db
              .select({
                totalChannelUsers: sql<number>`count(*)`,
                activeChannelUsers: sql<number>`count(*) filter (where ${schema.agentChannelUsers.isActive} = true)`,
              })
              .from(schema.agentChannelUsers)
              .where(eq(schema.agentChannelUsers.companyId, company.id));

            const auditStatsResult = await db
              .select({
                totalEvents: sql<number>`count(*)`,
              })
              .from(schema.auditLogs)
              .where(eq(schema.auditLogs.companyId, company.id));

            const recentAuditRows = await db
              .select({
                id: schema.auditLogs.id,
                action: schema.auditLogs.action,
                createdAt: schema.auditLogs.createdAt,
                changedByUserId: schema.auditLogs.changedByUserId,
                targetUserId: schema.auditLogs.targetUserId,
              })
              .from(schema.auditLogs)
              .where(eq(schema.auditLogs.companyId, company.id))
              .orderBy(desc(schema.auditLogs.createdAt))
              .limit(8);

            const userIds = Array.from(
              new Set(
                recentAuditRows
                  .flatMap((row) => [row.changedByUserId, row.targetUserId])
                  .filter((value): value is number => Number.isFinite(value)),
              ),
            );
            const auditUsers =
              userIds.length > 0
                ? await db
                    .select({
                      id: schema.users.id,
                      username: schema.users.username,
                    })
                    .from(schema.users)
                    .where(inArray(schema.users.id, userIds))
                : [];
            const userMap = new Map<number, string>(auditUsers.map((u) => [u.id, u.username]));
            const recentAudit = recentAuditRows.map((row) => ({
              ...row,
              changedByUsername: row.changedByUserId ? userMap.get(row.changedByUserId) ?? null : null,
              targetUsername: row.targetUserId ? userMap.get(row.targetUserId) ?? null : null,
            }));

            const activeMembers = members.filter((m) => m.membershipActive).length;
            const admins = members.filter((m) => m.companyRole === "owner").length;
            const moderators = members.filter((m) => m.companyRole === "moderator").length;

            return {
              profile: {
                id: company.id,
                name: company.name,
                slug: company.slug,
                packageTier: company.packageTier,
                createdAt: company.createdAt,
                updatedAt: company.updatedAt,
                hasCompanyKey: Boolean(company.hasCompanyKey),
                owner: company.ownerUserId
                  ? {
                      userId: company.ownerUserId,
                      username: company.ownerUsername,
                      email: company.ownerEmail,
                      isApproved: company.ownerApproved,
                    }
                  : null,
              },
              metrics: {
                membersTotal: members.length,
                membersActive: activeMembers,
                admins,
                moderators,
                postsTotal: Number(postsResult[0]?.totalPosts ?? 0),
                postsPublished: Number(postsResult[0]?.publishedPosts ?? 0),
                postsScheduled: Number(postsResult[0]?.scheduledPosts ?? 0),
                postsDraft: Number(postsResult[0]?.draftPosts ?? 0),
                socialConnections: Number(socialConnectionsResult[0]?.totalConnections ?? 0),
                channelConnections: Number(channelConnectionsResult[0]?.totalChannelUsers ?? 0),
                channelConnectionsActive: Number(channelConnectionsResult[0]?.activeChannelUsers ?? 0),
                auditEvents: Number(auditStatsResult[0]?.totalEvents ?? 0),
              },
              members,
              recentAudit,
            };
          }),
        );

        return res.json({ companies });
      } catch (error) {
        console.error("Error loading companies overview:", error);
        return res.status(500).json({ error: "Failed to load companies overview" });
      }
    },
  );

  // ==================== User Management ====================
  
  /**
   * Get all users (paginated)
   * GET /api/admin/users
   */
  app.get(
    "/api/admin/users",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const role = req.query.role as string;
        const deleted = String(req.query.deleted || "false").toLowerCase() === "true";
        const offset = (page - 1) * limit;

        // Build conditions array
        const conditions = [eq(schema.users.isDeleted, deleted)];
        
        if (search) {
          conditions.push(
            sql`(${schema.users.username} ILIKE ${`%${search}%`} OR ${schema.users.email} ILIKE ${`%${search}%`})`
          );
        }

        if (role) {
          conditions.push(eq(schema.users.role, role));
        }

        const query = db
          .select({
            id: schema.users.id,
            username: schema.users.username,
            email: schema.users.email,
            role: schema.users.role,
            permissions: schema.users.permissions,
            isActive: schema.users.isActive,
            isDeleted: schema.users.isDeleted,
            isApproved: schema.users.isApproved,
            packageTier: schema.users.packageTier,
            deletedAt: schema.users.deletedAt,
            createdAt: schema.users.createdAt,
            updatedAt: schema.users.updatedAt,
          })
          .from(schema.users)
          .where(and(...conditions))
          .orderBy(desc(schema.users.createdAt))
          .limit(limit)
          .offset(offset);

        const users = await query;
        const totalResult = await db
          .select({ count: count() })
          .from(schema.users)
          .where(and(...conditions));

        const total = totalResult[0]?.count || 0;

        res.json({
          users: users.map(u => ({
            ...u,
            permissions: u.permissions || [],
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
      }
    }
  );

  /**
   * Get user by ID
   * GET /api/admin/users/:id
   */
  app.get(
    "/api/admin/users/:id",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json(sanitizeUserForClient(user));
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Failed to fetch user" });
      }
    }
  );

  /**
   * Create new user
   * POST /api/admin/users
   */
  app.post(
    "/api/admin/users",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const actorRole = ((req.user?.role as UserRole) || "client");
        const assignableRoles = getAssignableRoles(actorRole);
        const body = z
          .object({
            username: z.string().min(3).max(30),
            email: z.string().email(),
            password: z.string().min(8),
            role: z.enum(["client", "super_admin"]).optional(),
            permissions: z.array(z.string()).optional(),
            isApproved: z.boolean().optional(),
            packageTier: z.enum(["basic", "advance"]).optional(),
          })
          .parse(req.body);

        if (body.role && !assignableRoles.includes(body.role as UserRole)) {
          return res.status(403).json({
            error: "Forbidden",
            message: `You cannot assign role '${body.role}'`,
          });
        }

        // Check if username exists
        const existingUser = await storage.getUserByUsername(body.username);
        if (existingUser) {
          return res.status(400).json({ error: "Username already exists" });
        }

        const hashedPassword = await hashPassword(body.password);

        const user = await storage.createUser({
          username: body.username,
          email: body.email,
          password: hashedPassword,
          role: (body.role || "client") as UserRole,
          permissions: body.permissions || [],
          isApproved: body.isApproved ?? true,
          packageTier: body.packageTier ?? "basic",
        } as any);

        res.status(201).json(sanitizeUserForClient(user));
      } catch (error) {
        console.error("Error creating user:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create user" });
      }
    }
  );

  /**
   * Update user
   * PATCH /api/admin/users/:id
   */
  app.patch(
    "/api/admin/users/:id",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const actorRole = ((req.user?.role as UserRole) || "client");
        const actorId = req.user!.id;
        const assignableRoles = getAssignableRoles(actorRole);
        const userId = parseInt(req.params.id);
        const body = z
          .object({
            email: z.string().email().optional(),
            role: z.enum(["client", "super_admin"]).optional(),
            permissions: z.array(z.string()).optional(),
            isActive: z.boolean().optional(),
            isApproved: z.boolean().optional(),
            packageTier: z.enum(["basic", "advance"]).optional(),
          })
          .parse(req.body);

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        if (body.role && !assignableRoles.includes(body.role as UserRole)) {
          return res.status(403).json({
            error: "Forbidden",
            message: `You cannot assign role '${body.role}'`,
          });
        }

        // Only super admins can directly edit custom permission arrays.
        if (body.permissions !== undefined && actorRole !== "super_admin") {
          return res.status(403).json({
            error: "Forbidden",
            message: "Only super admins can edit custom permissions",
          });
        }

        // Prevent non-super-admin users from mutating super-admin accounts.
        if (user.role === "super_admin" && actorRole !== "super_admin") {
          return res.status(403).json({
            error: "Forbidden",
            message: "Only super admins can modify super-admin accounts",
          });
        }

        // Prevent users from accidentally stripping their own super-admin role.
        if (actorId === userId && actorRole === "super_admin" && body.role && body.role !== "super_admin") {
          return res.status(400).json({
            error: "Cannot remove your own super admin role",
          });
        }

        // Update user
        const updates: any = {
          updatedAt: new Date(),
        };

        if (body.email) updates.email = body.email;
        if (body.role) updates.role = body.role;
        if (body.permissions !== undefined) updates.permissions = body.permissions;
        if (body.isActive !== undefined) updates.isActive = body.isActive;
        if (body.isApproved !== undefined) updates.isApproved = body.isApproved;
        if (body.packageTier !== undefined) updates.packageTier = body.packageTier;

        await db
          .update(schema.users)
          .set(updates)
          .where(eq(schema.users.id, userId));

        const updatedUser = await storage.getUser(userId);
        res.json(sanitizeUserForClient(updatedUser!));
      } catch (error) {
        console.error("Error updating user:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to update user" });
      }
    }
  );

  /**
   * Delete user (soft delete)
   * DELETE /api/admin/users/:id
   */
  app.delete(
    "/api/admin/users/:id",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const currentUserId = req.user!.id;

        if (userId === currentUserId) {
          return res.status(400).json({ error: "Cannot delete your own account" });
        }

        await db
          .update(schema.users)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userId));

        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Failed to delete user" });
      }
    }
  );

  /**
   * Restore soft-deleted user
   * POST /api/admin/users/:id/restore
   */
  app.post(
    "/api/admin/users/:id/restore",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const [row] = await db
          .update(schema.users)
          .set({
            isDeleted: false,
            deletedAt: null,
            updatedAt: new Date(),
          })
          .where(and(eq(schema.users.id, userId), eq(schema.users.isDeleted, true)))
          .returning();

        if (!row) return res.status(404).json({ error: "Deleted user not found" });
        return res.json({ success: true, user: sanitizeUserForClient(row) });
      } catch (error) {
        console.error("Error restoring user:", error);
        return res.status(500).json({ error: "Failed to restore user" });
      }
    }
  );

  /**
   * Permanently delete user
   * DELETE /api/admin/users/:id/permanent
   */
  app.delete(
    "/api/admin/users/:id/permanent",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const currentUserId = req.user!.id;
        if (userId === currentUserId) {
          return res.status(400).json({ error: "Cannot permanently delete your own account" });
        }

        const [deleted] = await db
          .delete(schema.users)
          .where(and(eq(schema.users.id, userId), eq(schema.users.isDeleted, true)))
          .returning({ id: schema.users.id });

        if (!deleted) return res.status(404).json({ error: "Deleted user not found" });
        return res.json({ success: true });
      } catch (error) {
        console.error("Error permanently deleting user:", error);
        return res.status(500).json({ error: "Failed to permanently delete user" });
      }
    }
  );

  // ==================== Feature Flags ====================
  
  /**
   * Get all feature flags
   * GET /api/admin/features
   */
  app.get(
    "/api/admin/features",
    requireSuperAdmin,
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

  /**
   * Update feature flag
   * POST /api/admin/features/:key
   */
  app.post(
    "/api/admin/features/:key",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const { key } = req.params;
        const { value } = z.object({ value: z.boolean() }).parse(req.body);

        if (!Object.values(FEATURE_KEYS).includes(key as any)) {
          return res.status(400).json({ error: "Invalid feature key" });
        }

        await updateFeatureFlag(key, value, req.user!.id);
        res.json({ success: true, key, value });
      } catch (error) {
        console.error("Error updating feature flag:", error);
        res.status(500).json({ error: "Failed to update feature flag" });
      }
    }
  );

  // ==================== System Statistics ====================
  
  /**
   * Get system statistics
   * GET /api/admin/statistics
   */
  app.get(
    "/api/admin/statistics",
    requireSuperAdmin,
    async (req, res) => {
      try {
        // User statistics
        const totalUsers = await db
          .select({ count: count() })
          .from(schema.users)
          .where(eq(schema.users.isDeleted, false));

        const activeUsers = await db
          .select({ count: count() })
          .from(schema.users)
          .where(and(eq(schema.users.isDeleted, false), eq(schema.users.isActive, true)));

        // Post statistics
        const totalPosts = await db
          .select({ count: count() })
          .from(schema.posts)
          .where(eq(schema.posts.isDeleted, false));

        const publishedPosts = await db
          .select({ count: count() })
          .from(schema.posts)
          .where(
            and(
              eq(schema.posts.isDeleted, false),
              eq(schema.posts.status, "published")
            )
          );

        const scheduledPosts = await db
          .select({ count: count() })
          .from(schema.posts)
          .where(
            and(
              eq(schema.posts.isDeleted, false),
              eq(schema.posts.status, "scheduled")
            )
          );

        // Subscription statistics
        const totalSubscriptions = await db
          .select({ count: count() })
          .from(schema.subscriptions);

        const activeSubscriptions = await db
          .select({ count: count() })
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.status, "active"));

        // Role distribution
        const roleDistribution = await db
          .select({
            role: schema.users.role,
            count: count(),
          })
          .from(schema.users)
          .where(eq(schema.users.isDeleted, false))
          .groupBy(schema.users.role);

        const packageTierDistribution = await db
          .select({
            packageTier: schema.users.packageTier,
            count: count(),
          })
          .from(schema.users)
          .where(eq(schema.users.isDeleted, false))
          .groupBy(schema.users.packageTier);

        res.json({
          users: {
            total: totalUsers[0]?.count || 0,
            active: activeUsers[0]?.count || 0,
            roles: roleDistribution,
            packageTiers: packageTierDistribution,
          },
          posts: {
            total: totalPosts[0]?.count || 0,
            published: publishedPosts[0]?.count || 0,
            scheduled: scheduledPosts[0]?.count || 0,
          },
          subscriptions: {
            total: totalSubscriptions[0]?.count || 0,
            active: activeSubscriptions[0]?.count || 0,
          },
        });
      } catch (error) {
        console.error("Error fetching statistics:", error);
        res.status(500).json({ error: "Failed to fetch statistics" });
      }
    }
  );

  app.get(
    "/api/admin/access-requests",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const requests = await storage.listAccessRequests(status);
        res.json({ requests });
      } catch (error) {
        console.error("Error listing access requests:", error);
        res.status(500).json({ error: "Failed to list requests" });
      }
    }
  );

  app.post(
    "/api/admin/access-requests/:id/approve",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const actorRole = ((req.user?.role as UserRole) || "client");
        const assignableRoles = getAssignableRoles(actorRole);
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ error: "Invalid id" });
        }
        const body = z
          .object({
            username: z.string().min(3).max(30),
            password: z.string().min(8),
            packageTier: z.enum(["basic", "advance"]),
            role: z.enum(["client", "super_admin"]).optional(),
          })
          .parse(req.body);

        if (body.role && !assignableRoles.includes(body.role as UserRole)) {
          return res.status(403).json({
            error: "Forbidden",
            message: `You cannot assign role '${body.role}'`,
          });
        }

        const row = await storage.getAccessRequest(id);
        if (!row) {
          return res.status(404).json({ error: "Request not found" });
        }
        if (row.status !== "pending") {
          return res.status(400).json({ error: "Request is not pending" });
        }
        if (row.deviceHash) {
          const approvedFromDevice = await storage.countApprovedAccessRequestsByDeviceHash(row.deviceHash);
          if (approvedFromDevice > 0) {
            return res.status(400).json({
              error:
                "Trial abuse protection: this device already has an approved trial account. Ask user to upgrade existing account.",
            });
          }
        }

        const existingUser = await storage.getUserByUsername(body.username);
        if (existingUser) {
          return res.status(400).json({ error: "Username already exists" });
        }

        const hashedPassword = await hashPassword(body.password);
        const user = await storage.createUser({
          username: body.username,
          email: row.email,
          password: hashedPassword,
          role: (body.role || "client") as UserRole,
          permissions: [],
          isApproved: true,
          packageTier: body.packageTier,
        } as any);

        await ensureDefaultCompanyModeratorMembership(user.id);

        await storage.updateAccessRequest(id, {
          status: "approved",
          approvedUserId: user.id,
        });

        let approvalNotificationSent = false;
        try {
          approvalNotificationSent = await notifyApprovedUser({
            to: row.email,
            username: body.username,
            temporaryPassword: body.password,
            packageTier: body.packageTier,
          });
        } catch (notifyErr) {
          console.error("Failed to send approval notification email:", notifyErr);
        }

        res.status(201).json({
          user: sanitizeUserForClient(user),
          message: approvalNotificationSent
            ? "User created, request approved, and approval email sent."
            : "User created and request marked approved. Approval email was not sent (check SMTP).",
          approvalNotificationSent,
        });
      } catch (error) {
        console.error("Error approving access request:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: (error as Error).message || "Failed to approve request" });
      }
    }
  );

  app.post(
    "/api/admin/access-requests/:id/reject",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ error: "Invalid id" });
        }
        const row = await storage.getAccessRequest(id);
        if (!row) {
          return res.status(404).json({ error: "Request not found" });
        }
        if (row.status !== "pending") {
          return res.status(400).json({ error: "Request is not pending" });
        }
        await storage.updateAccessRequest(id, { status: "rejected" });
        res.json({ ok: true });
      } catch (error) {
        console.error("Error rejecting access request:", error);
        res.status(500).json({ error: "Failed to reject request" });
      }
    }
  );

  app.get(
    "/api/admin/notification-settings",
    requireSuperAdmin,
    async (_req, res) => {
      try {
        const { storedEmail, effectiveEmail } = await getSuperAdminNotifyEmailSource();
        res.json({
          superAdminEmail: storedEmail,
          effectiveRecipient: effectiveEmail,
          smtpConfigured: isSmtpConfigured(),
          envSuperAdminConfigured: Boolean(process.env.SUPER_ADMIN_EMAIL?.trim()),
        });
      } catch (error) {
        console.error("notification-settings GET", error);
        res.status(500).json({ error: "Failed to load notification settings" });
      }
    }
  );

  app.put(
    "/api/admin/notification-settings",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const body = z
          .object({
            superAdminEmail: z.union([z.string().email(), z.literal("")]),
          })
          .parse(req.body);
        await setSuperAdminNotifyEmail(body.superAdminEmail, req.user!.id);
        const { storedEmail, effectiveEmail } = await getSuperAdminNotifyEmailSource();
        res.json({
          ok: true,
          superAdminEmail: storedEmail,
          effectiveRecipient: effectiveEmail,
        });
      } catch (error) {
        console.error("notification-settings PUT", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid email" });
        }
        res.status(500).json({ error: "Failed to save" });
      }
    }
  );

  // ==================== Admin Config ====================
  
  /**
   * Get admin configuration (roles, permissions, features)
   * GET /api/admin/config
   */
  app.get(
    "/api/admin/config",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const user = req.user!;
        const role = (user.role as UserRole) || "client";
        const customPermissions = (user.permissions as string[]) || [];
        const permissions = getUserPermissions(role, customPermissions);
        const availableFeatures = getAvailableFeatures(permissions);

        res.json({
          roles: ROLE_CONFIG,
          availableFeatures,
          userPermissions: permissions,
          userRole: role,
          assignableRoles: getAssignableRoles(role),
        });
      } catch (error) {
        console.error("Error fetching admin config:", error);
        res.status(500).json({ error: "Failed to fetch admin config" });
      }
    }
  );
}

