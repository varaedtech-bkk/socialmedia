// src/utils/rateLimiter.ts
import { storage } from "../../../server/storage";
import { PlatformName, UserTier, PLATFORMS } from "./types/platformTypes";

// Strongly typed platform limits with all tiers
const PLATFORM_LIMITS: Record<PlatformName, Record<UserTier, number>> = {
  'facebook-personal': { free: 2, pro: 10, enterprise: 50 },
  'facebook-page': { free: 4, pro: 15, enterprise: 100 },
  'instagram': { free: 1, pro: 5, enterprise: 30 },
  'linkedin': { free: 2, pro: 8, enterprise: 40 },
  'linkedin-page': { free: 2, pro: 8, enterprise: 40 },
  'twitter': { free: 1, pro: 5, enterprise: 25 },
  'youtube': { free: 1, pro: 3, enterprise: 15 },
  'tiktok': { free: 1, pro: 4, enterprise: 20 },
  'pinterest': { free: 2, pro: 6, enterprise: 30 },
  'snapchat': { free: 1, pro: 3, enterprise: 15 }
} as const;

// Runtime platform validation
  function isPlatform(name: string): name is PlatformName {
    return PLATFORMS.includes(name as PlatformName);
  }
// Tier validation
function isValidTier(tier: unknown): tier is UserTier {
    return tier === 'free' || tier === 'pro' || tier === 'enterprise';
  }
  

export const checkPlatformRateLimit = async (
    userId: number,
    platform: string
  ): Promise<{ 
    allowed: boolean;
    limit: number;
    remaining: number;
    tier: UserTier;
  }> => {
    if (!isPlatform(platform)) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  
    const userPackage = await storage.getUserPackage(userId);
    const tier: UserTier = isValidTier(userPackage?.tier) ? userPackage.tier : 'free';
    
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
// Enhanced tier limits lookup with all tiers
export const getPlatformLimitsForTier = (
    tier: UserTier
  ): Record<PlatformName, { 
    limit: number; 
    description: string 
  }> => {
    return PLATFORMS.reduce((acc, platform) => {
      const limit = PLATFORM_LIMITS[platform][tier];
      return {
        ...acc,
        [platform]: {
          limit,
          description: `Max ${limit} posts/hour (${tier} tier)`
        }
      };
    }, {} as Record<PlatformName, { limit: number; description: string }>);
  };