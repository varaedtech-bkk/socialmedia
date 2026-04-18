/**
 * OpenRouter recommends HTTP-Referer and X-OpenRouter-Title on chat requests.
 * Without them (or with a bad API key), their API may return HTTP 401 with message "User not found".
 * @see https://openrouter.ai/docs/api/reference/authentication
 */
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
