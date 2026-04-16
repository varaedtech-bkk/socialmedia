// src/middleware/postQuota.ts
import { Request, Response, NextFunction } from "express";
import { storage } from "../../../server/storage";
import { PACKAGES } from "./packages";
import { isFeatureEnabled, FEATURE_KEYS } from "../../../server/feature-config";

export const checkPostQuota = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  // Check if post quota feature is enabled
  if (!isFeatureEnabled(FEATURE_KEYS.POST_QUOTA_ENABLED)) {
    // Feature disabled - allow all posts
    req.quota = {
      tier: "UNLIMITED",
      used: 0,
      max: Infinity,
      remaining: Infinity
    };
    return next();
  }

  try {
    const user = req.user!;
    const currentMonth = new Date().getMonth();
    const userPosts = await storage.getUserPostCount(user.id, currentMonth);

    // Get user's package with fallback to STARTER
    const userPackage = await storage.getUserPackage(user.id);
    const tier = userPackage?.tier || "STARTER";
    const maxPosts = PACKAGES[tier as keyof typeof PACKAGES].posts;

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

    // Add quota info to request for logging/analytics
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

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      quota?: {
        tier: string;
        used: number;
        max: number;
        remaining: number;
      };
    }
  }
}