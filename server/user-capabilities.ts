import type { User } from "@shared/schema";
import { resolveOpenRouterApiKeyForUser } from "./openrouter-headers";

export type UserCapabilities = {
  aiGeneration: boolean;
  packageTier: "basic" | "advance";
};

/**
 * Advance AI features (dashboard + Telegram /ai) for everyone except super admins
 * require `package_tier === "advance"`. Super admins keep full access regardless of
 * stored tier so platform owners are not blocked by their own test account defaults.
 */
export function userHasAdvanceAiEntitlement(user: Pick<User, "packageTier" | "role">): boolean {
  if (user.role === "super_admin") return true;
  return user.packageTier === "advance";
}

export function getUserCapabilities(user: User): UserCapabilities {
  const tier = userHasAdvanceAiEntitlement(user) ? "advance" : "basic";
  const aiGeneration = tier === "advance" && Boolean(resolveOpenRouterApiKeyForUser(user));
  return { aiGeneration, packageTier: tier };
}
