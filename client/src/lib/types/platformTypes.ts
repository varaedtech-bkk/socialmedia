// src/types/platformTypes.ts
export const PLATFORMS = [
    'facebook-personal',
    'facebook-page',
    'instagram',
    'linkedin',
    'linkedin-page',
    'twitter',
    'youtube',
    'tiktok',
    'pinterest',
    'snapchat'
  ] as const;
  
  export type PlatformName = typeof PLATFORMS[number];
  export type UserTier = 'free' | 'pro' | 'enterprise'; // Added enterprise tier
  
  export interface PlatformLimits {
    free: number;
    pro: number;
    enterprise?: number; // Optional for platforms that need special handling
  }
  
  export type AllPlatformLimits = Partial<Record<PlatformName, PlatformLimits>>;