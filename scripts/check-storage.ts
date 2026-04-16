#!/usr/bin/env tsx
/**
 * Check which storage is being used
 */

import dotenv from "dotenv";
dotenv.config();

async function checkStorage() {
  console.log("\n🔍 Checking storage configuration...");
  console.log("=".repeat(50));
  
  console.log(`\nDATABASE_URL: ${process.env.DATABASE_URL ? "✅ Set" : "❌ Not set"}`);
  
  if (process.env.DATABASE_URL) {
    console.log(`   ${process.env.DATABASE_URL.substring(0, 30)}...`);
  }
  
  console.log("\n📦 Importing storage...");
  try {
    const { storage } = await import("../server/storage.js");
    
    console.log("\n✅ Storage imported successfully");
    console.log(`   Type: ${storage.constructor.name}`);
    
    // Try to get a user
    console.log("\n🧪 Testing getUserByUsername...");
    const user = await storage.getUserByUsername("superuser");
    
    if (user) {
      console.log("✅ User found in storage:");
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Storage type: ${storage.constructor.name}`);
    } else {
      console.log("❌ User not found in storage!");
      console.log(`   Storage type: ${storage.constructor.name}`);
      console.log("   This means storage is using in-memory (MemStorage) instead of database!");
    }
    
  } catch (error) {
    console.error("❌ Error importing storage:", error);
  }
}

checkStorage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

