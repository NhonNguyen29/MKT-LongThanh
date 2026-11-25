import { readFile } from "node:fs/promises";
import path from "node:path";
import { database } from "../lib/database";
async function main() {
  const pool = database();
  try {
    const sql = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/202611250001_marketing_private.sql",
      ),
      "utf8",
    );
    // Use one checked-out connection for the complete migration transaction.
    const client = await pool.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }
    console.log(
      "Private database schema migrated. No application data imported yet.",
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Migration failed. Check the administrative connection and database permissions; no credentials were logged.",
  );
  process.exitCode = 1;
});
