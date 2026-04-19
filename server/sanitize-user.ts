import type { User } from "@shared/schema";

/** Fields never sent to the browser JSON for /api/user, login, register. */
export type PublicUser = Omit<User, "password" | "openrouterApiKey">;

export function sanitizeUserForClient(user: User): PublicUser {
  const { password: _p, openrouterApiKey: _k, ...rest } = user;
  return rest;
}
