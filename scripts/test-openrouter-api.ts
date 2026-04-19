/**
 * Live OpenRouter check (same headers as the app). Run from repo root:
 *   yarn openrouter:test
 * Prints HTTP status and error body only — never the API key.
 */
import "../server/env-bootstrap";
import { getOpenRouterApiKey, openRouterRequestHeaders } from "../server/openrouter-headers";

const apiKey = getOpenRouterApiKey();
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is missing after dotenv.config()");
  process.exit(1);
}

const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: openRouterRequestHeaders(apiKey),
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "Reply with exactly: ok" }],
    max_tokens: 8,
  }),
});

const body = (await res.json().catch(() => ({}))) as {
  error?: { message?: string; code?: number };
  choices?: Array<{ message?: { content?: string } }>;
};

console.log("HTTP", res.status);
if (!res.ok) {
  console.log("OpenRouter error:", JSON.stringify(body?.error ?? body, null, 2));
  process.exit(1);
}
const text = body?.choices?.[0]?.message?.content?.trim();
console.log("OK — reply:", text ?? "(empty)");
