/**
 * Admin API Routes
 * 
 * All admin-related endpoints with role-based access control
 */

import { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { db, schema } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";
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
import { isSmtpConfigured } from "./smtp-send";

export function registerAdminRoutes(app: Express) {
  // ==================== User Management ====================
  
  /**
   * Get all users (paginated)
   * GET /api/admin/users
   */
  app.get(
    "/api/admin/users",
    requirePermission("users.view"),
    async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const role = req.query.role as string;
        const offset = (page - 1) * limit;

        // Build conditions array
        const conditions = [eq(schema.users.isDeleted, false)];
        
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
          .where(eq(schema.users.isDeleted, false));

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
    requirePermission("users.view"),
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
    requirePermission("users.create"),
    async (req, res) => {
      try {
        const body = z
          .object({
            username: z.string().min(3).max(30),
            email: z.string().email(),
            password: z.string().min(8),
            role: z.enum(["user", "admin", "super_admin"]).optional(),
            permissions: z.array(z.string()).optional(),
            isApproved: z.boolean().optional(),
            packageTier: z.enum(["basic", "advance"]).optional(),
          })
          .parse(req.body);

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
          role: (body.role || "user") as UserRole,
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
    requirePermission("users.edit"),
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const body = z
          .object({
            email: z.string().email().optional(),
            role: z.enum(["user", "admin", "super_admin"]).optional(),
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
    requirePermission("users.delete"),
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

  // ==================== Feature Flags ====================
  
  /**
   * Get all feature flags
   * GET /api/admin/features
   */
  app.get(
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

  /**
   * Update feature flag
   * POST /api/admin/features/:key
   */
  app.post(
    "/api/admin/features/:key",
    requirePermission("features.manage"),
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
    requirePermission("analytics.view"),
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
    requirePermission("users.view"),
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
    requirePermission("users.create"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ error: "Invalid id" });
        }
        const body = z
          .object({
            username: z.string().min(3).max(30),
            password: z.string().min(8),
            packageTier: z.enum(["basic", "advance"]),
            role: z.enum(["user", "admin", "super_admin"]).optional(),
          })
          .parse(req.body);

        const row = await storage.getAccessRequest(id);
        if (!row) {
          return res.status(404).json({ error: "Request not found" });
        }
        if (row.status !== "pending") {
          return res.status(400).json({ error: "Request is not pending" });
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
          role: (body.role || "user") as UserRole,
          permissions: [],
          isApproved: true,
          packageTier: body.packageTier,
        } as any);

        await storage.updateAccessRequest(id, {
          status: "approved",
          approvedUserId: user.id,
        });

        res.status(201).json({
          user: sanitizeUserForClient(user),
          message: "User created and request marked approved.",
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
    requirePermission("users.edit"),
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
    requirePermission("settings.view"),
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
    requirePermission("settings.edit"),
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
    requireAdmin,
    async (req, res) => {
      try {
        const user = req.user!;
        const role = (user.role as UserRole) || "user";
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

