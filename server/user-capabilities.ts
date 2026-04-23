import type { User } from "@shared/schema";
import { resolveOpenRouterApiKeyForUser } from "./openrouter-headers";
import { isTrialExpiredForUser } from "./trial-policy";

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

export function getUserCapabilities(
  user: User,
  opts?: {
    companyPackageTier?: "basic" | "advance";
    companyOpenRouterApiKey?: string | null;
    membershipAiEnabled?: boolean;
  }
): UserCapabilities {
  const companyTier = opts?.companyPackageTier;
  const tier = user.role === "super_admin"
    ? "advance"
    : (companyTier ?? user.packageTier) === "advance"
      ? "advance"
      : "basic";
  const aiSwitch = opts?.membershipAiEnabled ?? true;
  const trialExpired = isTrialExpiredForUser(user);
  const aiGeneration =
    tier === "advance" &&
    aiSwitch &&
    !trialExpired &&
    Boolean(resolveOpenRouterApiKeyForUser(user, null));
  return { aiGeneration, packageTier: tier };
}
