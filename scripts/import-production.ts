import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { database } from "../lib/database";
import { prepareProduction } from "../lib/production-import";
import type { State } from "../lib/types";

// Supply secrets through environment variables, never command arguments.
// Refuses to overwrite an initialized database. Re-runs cannot reset live users.
async function main() {
  const source: State = JSON.parse(
    await readFile(path.join(process.cwd(), ".local/state.json"), "utf8"),
  );
  const prepared = prepareProduction(
    source,
    process.env.ADMIN_EMAIL || "",
    process.env.ADMIN_PASSWORD || "",
  );
  const pool = database();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(19472511)");
    const existing = await client.query(
      "SELECT id FROM saoviet_private.mkt_state WHERE id=1 FOR UPDATE",
    );
    if (existing.rowCount)
      throw new Error(
        "Database already initialized; import stopped without overwriting data",
      );
    await client.query(
      "INSERT INTO saoviet_private.mkt_state(id,body) VALUES(1,$1)",
      [JSON.stringify(prepared)],
    );
    let count = 0;
    for (const name of await readdir(
      path.join(process.cwd(), ".local/assets"),
    )) {
      if (
        !/^(01-ai-cong-viec|02-seo-quang-cao|03-tin-hoc-van-phong)\.(png|md)$/.test(
          name,
        )
      )
        continue;
      const body = await readFile(
        path.join(process.cwd(), ".local/assets", name),
      );
      await client.query(
        "INSERT INTO saoviet_private.mkt_assets(name,content_type,body,sha256) VALUES($1,$2,$3,$4)",
        [
          name,
          name.endsWith(".png") ? "image/png" : "text/plain; charset=utf-8",
          body,
          createHash("sha256").update(body).digest("hex"),
        ],
      );
      count++;
    }
    if (count !== 6)
      throw new Error("Expected six source assets; import rolled back");
    await client.query("COMMIT");
    console.log(
      `Imported ${prepared.tasks.length} tasks and ${count} private assets; local sessions and test users were excluded.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(
    "Import failed:",
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")
      : "Unknown error",
  );
  process.exitCode = 1;
});
