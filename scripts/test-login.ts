#!/usr/bin/env tsx
/**
 * Test script to verify login functionality
 */

import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import dotenv from "dotenv";
import { db, schema } from "../server/db";
import { eq, and } from "drizzle-orm";

dotenv.config();

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function testLogin() {
  const username = process.argv[2] || "superuser";
  const password = process.argv[3] || "superpass123";

  try {
    console.log(`\n🔍 Testing login for: ${username}`);
    console.log("=".repeat(50));

    // 1. Check if user exists in database
    console.log("\n1️⃣  Checking if user exists...");
    const user = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.username, username), eq(schema.users.isDeleted, false)))
      .limit(1);

    if (user.length === 0) {
      console.log("❌ User not found in database!");
      return;
    }

    const dbUser = user[0];
    console.log("✅ User found:");
    console.log(`   ID: ${dbUser.id}`);
    console.log(`   Username: ${dbUser.username}`);
    console.log(`   Email: ${dbUser.email}`);
    console.log(`   Is Active: ${dbUser.isActive}`);
    console.log(`   Is Deleted: ${dbUser.isDeleted}`);
    console.log(`   Password hash format: ${dbUser.password.substring(0, 20)}...`);

    // 2. Check password format
    console.log("\n2️⃣  Checking password format...");
    if (!dbUser.password.includes(".")) {
      console.log("❌ Password format is invalid (should contain a dot separator)");
      return;
    }
    const [hashPart, saltPart] = dbUser.password.split(".");
    console.log(`   Hash length: ${hashPart.length} characters`);
    console.log(`   Salt length: ${saltPart.length} characters`);
    console.log("✅ Password format is valid");

    // 3. Test password comparison
    console.log("\n3️⃣  Testing password comparison...");
    const passwordMatch = await comparePasswords(password, dbUser.password);
    console.log(`   Password match: ${passwordMatch ? "✅ YES" : "❌ NO"}`);

    if (!passwordMatch) {
      console.log("\n❌ Password comparison failed!");
      console.log("   This could mean:");
      console.log("   - The password in the database doesn't match");
      console.log("   - The password was hashed with a different method");
      return;
    }

    // 4. Test storage.getUserByUsername
    console.log("\n4️⃣  Testing storage.getUserByUsername...");
    const { storage } = await import("../server/storage");
    const storageUser = await storage.getUserByUsername(username);
    
    if (!storageUser) {
      console.log("❌ Storage.getUserByUsername returned null!");
      return;
    }
    console.log("✅ Storage.getUserByUsername works:");
    console.log(`   Username: ${storageUser.username}`);
    console.log(`   Email: ${storageUser.email}`);

    // 5. Test password comparison with storage user
    console.log("\n5️⃣  Testing password comparison with storage user...");
    const storagePasswordMatch = await comparePasswords(password, storageUser.password);
    console.log(`   Password match: ${storagePasswordMatch ? "✅ YES" : "❌ NO"}`);

    if (storagePasswordMatch) {
      console.log("\n✅✅✅ All tests passed! Login should work.");
    } else {
      console.log("\n❌ Password comparison with storage user failed!");
    }

  } catch (error) {
    console.error("\n❌ Error during test:", error);
    process.exit(1);
  }
}

testLogin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

