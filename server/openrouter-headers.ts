/**
 * OpenRouter recommends HTTP-Referer and X-OpenRouter-Title on chat requests.
 * Without them (or with a bad API key), their API may return HTTP 401 with message "User not found".
 * @see https://openrouter.ai/docs/api/reference/authentication
 */
import type { User } from "@shared/schema";

/** Strip BOM / outer quotes that often end up in .env and break Bearer auth. */
export function normalizeOpenRouterApiKey(raw: string): string {
  let k = raw.replace(/^\uFEFF/, "").trim();
  if (
    k.length >= 2 &&
    ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'")))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k;
}

export function getOpenRouterApiKey(): string | undefined {
  const raw = process.env.OPENROUTER_API_KEY;
  if (!raw) return undefined;
  const k = normalizeOpenRouterApiKey(raw);
  return k ? k : undefined;
}

/** Per-user key first, then optional platform key in env (migration / ops). */
export function resolveOpenRouterApiKeyForUser(user: Pick<User, "openrouterApiKey"> | null | undefined): string | undefined {
  const raw = user?.openrouterApiKey;
  if (raw) {
    const k = normalizeOpenRouterApiKey(raw);
    if (k) return k;
  }
  return getOpenRouterApiKey();
}

export function maskOpenRouterApiKeyHint(key: string): string {
  const k = normalizeOpenRouterApiKey(key);
  if (k.length <= 10) return "********";
  return `${k.slice(0, 8)}…${k.slice(-4)}`;
}

export function openRouterRequestHeaders(apiKey: string): Record<string, string> {
  const referer = (process.env.CLIENT_URL || process.env.BASE_URL || "https://localhost").replace(/\/$/, "");
  const title = (process.env.OPENROUTER_APP_TITLE || "Social Media Manager").trim() || "Social Media Manager";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": referer,
    "X-OpenRouter-Title": title,
  };
}
