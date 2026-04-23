#!/usr/bin/env tsx
/**
 * Apply migrations 0001+ idempotently (SQL uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS where needed).
 *
 * Use when `yarn db:migrate` fails on the first migration (e.g. relation "platform_rate_limits" already exists)
 * because the database was originally created with `drizzle-kit push` or manual SQL, so the Drizzle journal
 * and the real schema are out of sync.
 *
 * Requires: DATABASE_URL
 *
 * Usage: yarn db:ensure-incremental
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const MIGRATIONS = [
  "0001_social_accounts_telegram.sql",
  "0002_user_openrouter_api_key.sql",
  "0003_access_onboarding.sql",
  "0004_post_content_overrides.sql",
  "0005_company_tenants.sql",
  "0006_agent_channel_users.sql",
  "0007_access_request_payments.sql",
  "0008_access_request_device_hash.sql",
  "0009_fix_default_company_roles.sql",
  "0010_simplify_roles.sql",
] as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const client = new pkg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    for (const name of MIGRATIONS) {
      const path = join(root, "migrations", name);
      let sql = readFileSync(path, "utf8");
      sql = sql.replace(/--> statement-breakpoint\r?\n/g, "\n").trim();
      if (!sql) continue;
      console.log(`Applying ${name}…`);
      await client.query(sql);
      console.log(`  ✓ ${name}`);
    }
    console.log("\nIncremental migrations applied (safe to re-run).");
    console.log("Tenant tables and channel mapping tables are now ensured.");
    console.log("You can now log in safely, then create/manage admins as needed.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
