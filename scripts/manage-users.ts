#!/usr/bin/env tsx
/**
 * Script to manage users - create new user and optionally remove old ones
 * Usage: tsx scripts/manage-users.ts
 */

import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import dotenv from "dotenv";
import { db, schema } from "../server/db";
import { eq, and, ne } from "drizzle-orm";

dotenv.config();

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function manageUsers() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Get credentials from environment or use defaults
  const username = process.env.NEW_USERNAME || "admin";
  const password = process.env.NEW_PASSWORD || "admin123";
  const email = process.env.NEW_EMAIL || "admin@socialmanager.com";
  const removeOld = process.env.REMOVE_OLD_USERS === "true";

  try {
    // List existing users
    console.log("\n📋 Current users in database:");
    const existingUsers = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.isDeleted, false));

    if (existingUsers.length === 0) {
      console.log("   No users found.");
    } else {
      existingUsers.forEach((user) => {
        console.log(`   - ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Active: ${user.isActive}`);
      });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`\n⚠️  User "${username}" already exists!`);
      console.log(`   Updating password for existing user...`);
      
      // Update password for existing user
      const hashedPassword = await hashPassword(password);
      await db
        .update(schema.users)
        .set({
          password: hashedPassword,
          email: email,
          isActive: true,
          isDeleted: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.username, username));

      console.log("✅ Password updated successfully!");
    } else {
      // Create new user
      console.log(`\n➕ Creating new user: ${username}`);
      const hashedPassword = await hashPassword(password);
      
      const result = await db
        .insert(schema.users)
        .values({
          username,
          email,
          password: hashedPassword,
          isActive: true,
          isDeleted: false,
        })
        .returning();

      const user = result[0];
      console.log("✅ User created successfully!");
      console.log(`   User ID: ${user.id}`);
    }

    // Remove old users if requested
    if (removeOld) {
      console.log("\n🗑️  Removing old users (keeping only the new one)...");
      const usersToDelete = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.isDeleted, false),
            ne(schema.users.username, username)
          )
        );

      if (usersToDelete.length > 0) {
        for (const user of usersToDelete) {
          await db
            .update(schema.users)
            .set({
              isDeleted: true,
              deletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.users.id, user.id));
          console.log(`   ✅ Deleted user: ${user.username} (ID: ${user.id})`);
        }
        console.log(`\n   Removed ${usersToDelete.length} old user(s).`);
      } else {
        console.log("   No old users to remove.");
      }
    }

    // Show final credentials
    console.log("\n" + "=".repeat(50));
    console.log("📋 LOGIN CREDENTIALS:");
    console.log("=".repeat(50));
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Email: ${email}`);
    console.log("=".repeat(50));
    console.log("\n💡 To use custom credentials, set environment variables:");
    console.log("   NEW_USERNAME=your_username");
    console.log("   NEW_PASSWORD=your_password");
    console.log("   NEW_EMAIL=your_email@example.com");
    console.log("   REMOVE_OLD_USERS=true  (to delete old users)");
    console.log("\n⚠️  Please change the password after first login!\n");

  } catch (error) {
    console.error("❌ Failed to manage users:", error);
    process.exit(1);
  }
}

// Run the script
manageUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

