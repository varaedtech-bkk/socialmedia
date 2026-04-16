/**
 * Role-Based Access Control Middleware
 */

import { Request, Response, NextFunction } from "express";
import { UserRole, Permission, hasPermission, canAccessAdmin } from "../admin-config";

/**
 * Middleware to check if user has a specific permission
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = req.user!;
    const role = (user.role as UserRole) || "user";
    const customPermissions = (user.permissions as string[]) || [];

    if (!hasPermission(role, permission, customPermissions)) {
      return res.status(403).json({ 
        error: "Forbidden",
        message: `You don't have permission to ${permission}`,
      });
    }

    next();
  };
}

/**
 * Middleware to check if user can access admin panel
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = req.user!;
  const role = (user.role as UserRole) || "user";

  if (!canAccessAdmin(role)) {
    return res.status(403).json({ 
      error: "Forbidden",
      message: "Admin access required",
    });
  }

  next();
}

/**
 * Middleware to check if user has one of the specified permissions
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = req.user!;
    const role = (user.role as UserRole) || "user";
    const customPermissions = (user.permissions as string[]) || [];

    const hasAnyPermission = permissions.some(permission => 
      hasPermission(role, permission, customPermissions)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({ 
        error: "Forbidden",
        message: "Insufficient permissions",
      });
    }

    next();
  };
}

