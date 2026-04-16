/**
 * Script to set a user as super admin
 * Usage: yarn set-super-admin <username>
 */

import { db, schema } from "../server/db";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function setSuperAdmin(username: string) {
  try {
    const result = await db
      .update(schema.users)
      .set({
        role: "super_admin",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.username, username))
      .returning();

    if (result.length === 0) {
      console.error(`❌ User "${username}" not found`);
      process.exit(1);
    }

    console.log(`✅ User "${username}" is now a super admin`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting super admin:", error);
    process.exit(1);
  }
}

const username = process.argv[2];
if (!username) {
  console.error("Usage: yarn set-super-admin <username>");
  process.exit(1);
}

setSuperAdmin(username);

