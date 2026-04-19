/**
 * Must be imported first from `server/index.ts`.
 * Loads `.env` from the process cwd. In non-production, variables in `.env`
 * override the shell so a stale exported `OPENROUTER_API_KEY` cannot mask
 * the key in `.env` (default dotenv does not override existing env vars).
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
dotenv.config({
  path: envPath,
  override: process.env.NODE_ENV !== "production",
});
