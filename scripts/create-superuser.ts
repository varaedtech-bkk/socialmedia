#!/usr/bin/env tsx
/**
 * Script to create a superuser account
 * Usage: tsx scripts/create-superuser.ts
 */

import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import dotenv from "dotenv";
import { db, schema } from "../server/db";
import { eq } from "drizzle-orm";

dotenv.config();

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createSuperUser() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Default superuser credentials (can be overridden with environment variables)
  const username = process.env.SUPERUSER_USERNAME || "admin";
  const password = process.env.SUPERUSER_PASSWORD || "admin123";
  const email = process.env.SUPERUSER_EMAIL || "admin@socialmanager.com";

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`❌ User "${username}" already exists!`);
      console.log(`   If you want to update the password, please delete the user first or use a different username.`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const result = await db
      .insert(schema.users)
      .values({
        username,
        email,
        password: hashedPassword,
        role: "super_admin",
        isActive: true,
        isDeleted: false,
      })
      .returning();

    const user = result[0];

    console.log("✅ Super admin created successfully (role: super_admin)!");
    console.log("\n📋 Login Credentials:");
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Email: ${email}`);
    console.log(`   User ID: ${user.id}`);
    console.log("\n⚠️  Please change the password after first login!");
    console.log("\n💡 To use custom credentials, set environment variables:");
    console.log("   SUPERUSER_USERNAME=your_username");
    console.log("   SUPERUSER_PASSWORD=your_password");
    console.log("   SUPERUSER_EMAIL=your_email@example.com");
  } catch (error) {
    console.error("❌ Failed to create superuser:", error);
    process.exit(1);
  }
}

// Run the script
createSuperUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

