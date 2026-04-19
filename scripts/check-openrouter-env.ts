/**
 * Run from repo root: npx tsx scripts/check-openrouter-env.ts
 * Prints whether OPENROUTER_API_KEY is set (length only; never prints the key).
 */
import "../server/env-bootstrap";
import { getOpenRouterApiKey } from "../server/openrouter-headers";

const k = getOpenRouterApiKey();
console.log("OPENROUTER_API_KEY: set=", Boolean(k), "length=", k?.length ?? 0);
