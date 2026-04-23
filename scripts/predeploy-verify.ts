#!/usr/bin/env tsx
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

function loadEnv(): void {
  const explicit = process.env.PREDEPLOY_ENV_FILE?.trim();
  if (explicit) {
    config({ path: explicit });
    return;
  }
  if (fs.existsSync(path.join(process.cwd(), ".env.production"))) {
    config({ path: ".env.production" });
    return;
  }
  config();
}

const requiredVars: string[] = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "CLIENT_URL",
];

const recommendedVars: string[] = [
  "SUPER_ADMIN_EMAIL",
  "STRIPE_SECRET_KEY",
  "META_PAGE_APP_ID",
  "TELEGRAM_BOT_TOKEN",
];

async function checkEnvVars(): Promise<boolean> {
  console.log("Checking environment variables...");
  const missingRequired = requiredVars.filter((v) => !process.env[v]?.trim());
  if (missingRequired.length > 0) {
    console.error(`Missing required env vars: ${missingRequired.join(", ")}`);
    return false;
  }
  console.log("Required env vars: OK");

  const missingRecommended = recommendedVars.filter((v) => !process.env[v]?.trim());
  if (missingRecommended.length > 0) {
    console.warn(`Recommended but missing: ${missingRecommended.join(", ")}`);
  } else {
    console.log("Recommended env vars: OK");
  }
  return true;
}

async function checkDatabase(): Promise<boolean> {
  console.log("\nChecking database connectivity...");
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    console.error("DATABASE_URL is missing");
    return false;
  }

  const pool = new Pool({ connectionString: conn });
  try {
    await pool.query("SELECT 1");
    console.log("Database connection: OK");
    return true;
  } catch (err) {
    console.error("Database connection failed:", (err as Error).message);
    return false;
  } finally {
    await pool.end();
  }
}

async function checkMigrationMarkers(): Promise<boolean> {
  console.log("\nChecking migration markers...");
  const conn = process.env.DATABASE_URL;
  if (!conn) return false;

  const pool = new Pool({ connectionString: conn });
  try {
    const companies = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'companies'
      ) AS ok
    `);
    const memberships = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'company_memberships'
      ) AS ok
    `);
    const agentUsers = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'agent_channel_users'
      ) AS ok
    `);

    const ok =
      companies.rows[0]?.ok === true &&
      memberships.rows[0]?.ok === true &&
      agentUsers.rows[0]?.ok === true;

    if (!ok) {
      console.error(
        "Required tables missing (companies/company_memberships/agent_channel_users). Run npm run db:migrate.",
      );
      return false;
    }
    console.log("Migration marker tables: OK");
    return true;
  } catch (err) {
    console.error("Migration marker check failed:", (err as Error).message);
    return false;
  } finally {
    await pool.end();
  }
}

async function checkCriticalPaths(): Promise<boolean> {
  console.log("\nChecking critical file paths...");
  const files = [
    "server/routes.ts",
    "server/routes-admin.ts",
    "server/routes-telegram.ts",
    "server/auth.ts",
    "server/storage.ts",
  ];
  let ok = true;
  for (const rel of files) {
    const full = path.join(process.cwd(), rel);
    if (fs.existsSync(full)) {
      console.log(`OK ${rel}`);
    } else {
      console.error(`Missing ${rel}`);
      ok = false;
    }
  }
  return ok;
}

async function main(): Promise<void> {
  loadEnv();
  console.log("Pre-deployment verification\n");

  const envOk = await checkEnvVars();
  const dbOk = await checkDatabase();
  const migrationOk = await checkMigrationMarkers();
  const pathsOk = await checkCriticalPaths();

  const allPass = envOk && dbOk && migrationOk && pathsOk;
  console.log("\n" + "=".repeat(48));
  if (allPass) {
    console.log("All checks passed. Ready for deployment.");
    process.exit(0);
  }
  console.error("One or more checks failed. Fix before deploying.");
  process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected predeploy verification error:", err);
  process.exit(1);
});

