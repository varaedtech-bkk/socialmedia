import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();

test("critical migration marker tables exist", async () => {
  const conn = process.env.DATABASE_URL;
  assert.ok(conn, "DATABASE_URL is required for DB tests");

  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    const tables = ["companies", "company_memberships", "agent_channel_users"];
    for (const table of tables) {
      const q = await client.query(
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
         ) AS ok`,
        [table],
      );
      assert.equal(q.rows[0]?.ok, true, `missing table: ${table}`);
    }
  } finally {
    await client.end();
  }
});

