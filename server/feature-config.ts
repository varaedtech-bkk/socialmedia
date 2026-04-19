/**
 * Feature Configuration Service
 * 
 * Manages feature flags and app settings that can be toggled by super admins.
 * This allows easy enabling/disabling of features like subscriptions without code changes.
 */

import { db, schema } from "./db";
import { eq } from "drizzle-orm";

// Feature flag keys
export const FEATURE_KEYS = {
  SUBSCRIPTIONS_ENABLED: "subscriptions_enabled",
  POST_QUOTA_ENABLED: "post_quota_enabled",
  STRIPE_PAYMENTS_ENABLED: "stripe_payments_enabled",
  /** When false, POST /api/register is rejected (super admin onboards users). */
  PUBLIC_REGISTRATION_ENABLED: "public_registration_enabled",
} as const;

// Default feature values
const DEFAULT_FEATURES = {
  [FEATURE_KEYS.SUBSCRIPTIONS_ENABLED]: true,
  [FEATURE_KEYS.POST_QUOTA_ENABLED]: true,
  [FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED]: true,
  [FEATURE_KEYS.PUBLIC_REGISTRATION_ENABLED]: false,
} as const;

// In-memory cache for feature flags (refreshed on update)
let featureCache: Map<string, boolean> = new Map();

/**
 * Initialize feature flags with default values if they don't exist
 */
export async function initializeFeatureFlags(): Promise<void> {
  try {
    for (const [key, defaultValue] of Object.entries(DEFAULT_FEATURES)) {
      const existing = await db
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.key, key))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.appSettings).values({
          key,
          value: defaultValue,
          description: getFeatureDescription(key),
        });
        featureCache.set(key, defaultValue);
      } else {
        // Load existing value into cache
        const value = existing[0].value as boolean;
        featureCache.set(key, value);
      }
    }
    console.log("✅ Feature flags initialized");
  } catch (error) {
    console.error("⚠️  Failed to initialize feature flags:", error);
    // Fallback to defaults if DB fails
    Object.entries(DEFAULT_FEATURES).forEach(([key, value]) => {
      featureCache.set(key, value);
    });
  }
}

/**
 * Get feature description for a given key
 */
function getFeatureDescription(key: string): string {
  const descriptions: Record<string, string> = {
    [FEATURE_KEYS.SUBSCRIPTIONS_ENABLED]: "Enable/disable subscription plans and tier management",
    [FEATURE_KEYS.POST_QUOTA_ENABLED]: "Enable/disable post quota limits based on subscription tiers",
    [FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED]: "Enable/disable Stripe payment processing",
    [FEATURE_KEYS.PUBLIC_REGISTRATION_ENABLED]:
      "Allow anyone to self-register. When off, only super admins create accounts (recommended for B2B).",
  };
  return descriptions[key] || "Feature flag";
}

/**
 * Check if a feature is enabled
 * Uses cache for performance, falls back to default if not found
 */
export function isFeatureEnabled(key: string): boolean {
  if (featureCache.has(key)) {
    return featureCache.get(key) ?? false;
  }
  
  // Fallback to default if not in cache
  const defaultValue = DEFAULT_FEATURES[key as keyof typeof DEFAULT_FEATURES];
  return defaultValue ?? false;
}

/**
 * Get feature flag value from database (bypasses cache)
 */
export async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    const result = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key))
      .limit(1);

    if (result.length === 0) {
      const defaultValue = DEFAULT_FEATURES[key as keyof typeof DEFAULT_FEATURES];
      return defaultValue ?? false;
    }

    const value = result[0].value as boolean;
    // Update cache
    featureCache.set(key, value);
    return value;
  } catch (error) {
    console.error(`Error fetching feature flag ${key}:`, error);
    // Fallback to default
    const defaultValue = DEFAULT_FEATURES[key as keyof typeof DEFAULT_FEATURES];
    return defaultValue ?? false;
  }
}

/**
 * Update a feature flag (admin only)
 */
export async function updateFeatureFlag(
  key: string,
  value: boolean,
  updatedBy?: number
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.appSettings)
        .set({
          value,
          updatedBy: updatedBy || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.appSettings.key, key));
    } else {
      await db.insert(schema.appSettings).values({
        key,
        value,
        description: getFeatureDescription(key),
        updatedBy: updatedBy || null,
      });
    }

    // Update cache
    featureCache.set(key, value);
    console.log(`✅ Feature flag ${key} updated to ${value}`);
  } catch (error) {
    console.error(`Error updating feature flag ${key}:`, error);
    throw error;
  }
}

/**
 * Get all feature flags
 */
export async function getAllFeatureFlags(): Promise<
  Array<{
    key: string;
    value: boolean;
    description: string | null;
    updatedAt: Date;
  }>
> {
  try {
    // Get all feature flags
    const allSettings = await db.select().from(schema.appSettings);
    
    // Filter to only feature flags and map to return format
    const featureFlags = allSettings
      .filter((setting) => Object.values(FEATURE_KEYS).includes(setting.key as any))
      .map((setting) => ({
        key: setting.key,
        value: setting.value as boolean,
        description: setting.description,
        updatedAt: setting.updatedAt,
      }));

    // Ensure all feature keys are present (add defaults for missing ones)
    const existingKeys = new Set(featureFlags.map(f => f.key));
    const missingFlags = Object.entries(DEFAULT_FEATURES)
      .filter(([key]) => !existingKeys.has(key))
      .map(([key, value]) => ({
        key,
        value,
        description: getFeatureDescription(key),
        updatedAt: new Date(),
      }));

    return [...featureFlags, ...missingFlags];
  } catch (error) {
    console.error("Error fetching all feature flags:", error);
    // Return defaults if DB fails
    return Object.entries(DEFAULT_FEATURES).map(([key, value]) => ({
      key,
      value,
      description: getFeatureDescription(key),
      updatedAt: new Date(),
    }));
  }
}

/**
 * Refresh feature flag cache from database
 */
export async function refreshFeatureCache(): Promise<void> {
  try {
    const allFlags = await getAllFeatureFlags();
    featureCache.clear();
    allFlags.forEach((flag) => {
      featureCache.set(flag.key, flag.value);
    });
  } catch (error) {
    console.error("Error refreshing feature cache:", error);
  }
}

