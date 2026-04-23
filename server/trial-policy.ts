import type { User } from "@shared/schema";

const DEFAULT_TRIAL_DAYS = 7;

export function getTrialDays(): number {
  const raw = Number(process.env.TRIAL_DAYS || "");
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TRIAL_DAYS;
  return Math.floor(raw);
}

export function getTrialDurationMs(): number {
  return getTrialDays() * 24 * 60 * 60 * 1000;
}

export function computeTrialEndDate(createdAt: Date): Date {
  return new Date(createdAt.getTime() + getTrialDurationMs());
}

export function isTrialEligibleForUser(user: Pick<User, "role" | "packageTier" | "stripeCustomerId">): boolean {
  return user.role !== "super_admin" && user.packageTier === "advance" && !user.stripeCustomerId;
}

export function isTrialExpiredForUser(
  user: Pick<User, "role" | "packageTier" | "stripeCustomerId" | "createdAt">,
): boolean {
  if (!isTrialEligibleForUser(user)) return false;
  return computeTrialEndDate(user.createdAt).getTime() <= Date.now();
}
