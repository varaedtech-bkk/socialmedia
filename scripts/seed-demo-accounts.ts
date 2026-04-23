#!/usr/bin/env tsx
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import dotenv from "dotenv";
import { db, schema } from "../server/db";
import { and, eq } from "drizzle-orm";

dotenv.config();
const scryptAsync = promisify(scrypt);

type DemoUserSeed = {
  username: string;
  email: string;
  password: string;
  appRole: "super_admin" | "client";
  packageTier: "basic" | "advance";
  companyRole?: "owner" | "moderator";
};
type SeededUser = DemoUserSeed & { id: number };

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function upsertUser(seed: DemoUserSeed) {
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, seed.username))
    .limit(1);

  const hashed = await hashPassword(seed.password);
  if (existing.length > 0) {
    const updated = await db
      .update(schema.users)
      .set({
        email: seed.email,
        password: hashed,
        role: seed.appRole,
        packageTier: seed.packageTier,
        isActive: true,
        isDeleted: false,
        isApproved: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, existing[0].id))
      .returning();
    return updated[0];
  }

  const inserted = await db
    .insert(schema.users)
    .values({
      username: seed.username,
      email: seed.email,
      password: hashed,
      role: seed.appRole,
      packageTier: seed.packageTier,
      isActive: true,
      isDeleted: false,
      isApproved: true,
      permissions: [],
    })
    .returning();
  return inserted[0];
}

async function ensureCompany(name: string, slug: string, ownerUserId?: number) {
  const existing = await db.select().from(schema.companies).where(eq(schema.companies.slug, slug)).limit(1);
  if (existing.length > 0) {
    const updated = await db
      .update(schema.companies)
      .set({
        name,
        ownerUserId: ownerUserId ?? existing[0].ownerUserId,
        packageTier: "advance",
        updatedAt: new Date(),
      })
      .where(eq(schema.companies.id, existing[0].id))
      .returning();
    return updated[0];
  }

  const inserted = await db
    .insert(schema.companies)
    .values({
      name,
      slug,
      packageTier: "advance",
      ownerUserId: ownerUserId ?? null,
    })
    .returning();
  return inserted[0];
}

async function ensureMembership(
  companyId: number,
  userId: number,
  role: "owner" | "moderator",
) {
  const existing = await db
    .select()
    .from(schema.companyMemberships)
    .where(
      and(
        eq(schema.companyMemberships.companyId, companyId),
        eq(schema.companyMemberships.userId, userId),
      ),
    )
    .limit(1);

  const fullPlatforms = [
    "facebook-page",
    "instagram",
    "linkedin",
    "linkedin-page",
    "twitter",
    "youtube",
    "tiktok",
    "pinterest",
    "snapchat",
    "whatsapp",
  ];

  if (existing.length > 0) {
    await db
      .update(schema.companyMemberships)
      .set({
        role,
        aiEnabled: true,
        isActive: true,
        allowedPlatforms: fullPlatforms,
        updatedAt: new Date(),
      })
      .where(eq(schema.companyMemberships.id, existing[0].id));
    return;
  }

  await db.insert(schema.companyMemberships).values({
    companyId,
    userId,
    role,
    aiEnabled: true,
    isActive: true,
    allowedPlatforms: fullPlatforms,
  });
}

async function main() {
  const seeds: DemoUserSeed[] = [
    {
      username: process.env.DEMO_SUPER_ADMIN_USERNAME || "demo_superadmin",
      email: process.env.DEMO_SUPER_ADMIN_EMAIL || "demo.superadmin@multisocial.local",
      password: process.env.DEMO_SUPER_ADMIN_PASSWORD || "DemoSuperAdmin@123",
      appRole: "super_admin",
      packageTier: "advance",
    },
    {
      username: process.env.DEMO_OWNER_USERNAME || "demo_owner",
      email: process.env.DEMO_OWNER_EMAIL || "demo.owner@acme.local",
      password: process.env.DEMO_OWNER_PASSWORD || "DemoOwner@123",
      appRole: "client",
      packageTier: "advance",
      companyRole: "owner",
    },
    {
      username: process.env.DEMO_ADMIN_USERNAME || "demo_admin",
      email: process.env.DEMO_ADMIN_EMAIL || "demo.admin@acme.local",
      password: process.env.DEMO_ADMIN_PASSWORD || "DemoAdmin@123",
      appRole: "client",
      packageTier: "advance",
    },
    {
      username: process.env.DEMO_MODERATOR_USERNAME || "demo_moderator",
      email: process.env.DEMO_MODERATOR_EMAIL || "demo.moderator@acme.local",
      password: process.env.DEMO_MODERATOR_PASSWORD || "DemoModerator@123",
      appRole: "client",
      packageTier: "advance",
      companyRole: "moderator",
    },
    {
      username: process.env.DEMO_BASIC_USER_USERNAME || "demo_basic",
      email: process.env.DEMO_BASIC_USER_EMAIL || "demo.basic@starter.local",
      password: process.env.DEMO_BASIC_USER_PASSWORD || "DemoBasic@123",
      appRole: "client",
      packageTier: "basic",
      companyRole: "moderator",
    },
  ];

  const created: SeededUser[] = [];
  for (const seed of seeds) {
    const user = await upsertUser(seed);
    created.push({ ...seed, id: user.id });
  }

  const owner = created.find((u) => u.username === (process.env.DEMO_OWNER_USERNAME || "demo_owner"));
  const companyAcme = await ensureCompany("Acme Demo Company", "acme-demo-company", owner?.id);
  const companyStarter = await ensureCompany("Starter Demo Company", "starter-demo-company");

  for (const seed of created) {
    if (seed.companyRole) {
      const companyId = seed.username === (process.env.DEMO_BASIC_USER_USERNAME || "demo_basic")
        ? companyStarter.id
        : companyAcme.id;
      await ensureMembership(companyId, seed.id, seed.companyRole);
    }
  }

  console.log("\n=== Demo Accounts Seeded ===");
  for (const seed of created) {
    console.log(
      `${seed.username} | ${seed.password} | appRole=${seed.appRole} | companyRole=${seed.companyRole || "-"} | tier=${seed.packageTier}`,
    );
  }
  console.log("\nCompany A:", companyAcme.name, `(id=${companyAcme.id})`);
  console.log("Company B:", companyStarter.name, `(id=${companyStarter.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

