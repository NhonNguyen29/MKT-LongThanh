import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { database, databaseUrl } from "./database";
import type { State } from "./types";
import { initialState } from "./seed";
const globalStore = globalThis as typeof globalThis & {
  mktQueue?: Promise<unknown>;
};
export const storageMode = () => (databaseUrl() ? "postgres" : "local");
async function operation<T>(fn: (state: State) => T | Promise<T>): Promise<T> {
  if (databaseUrl()) {
    const pool = database();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(19472511)");
      let row = await client.query(
        "SELECT body FROM saoviet_private.mkt_state WHERE id=1 FOR UPDATE",
      );
      let state: State = row.rows[0]?.body ?? initialState();
      const result = await fn(state);
      await client.query(
        "INSERT INTO saoviet_private.mkt_state(id,body) VALUES (1,$1) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
        [JSON.stringify(state)],
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  if (process.env.VERCEL)
    throw new Error(
      "Cần kết nối DATABASE_URL PostgreSQL trên Vercel để lưu dữ liệu dùng chung.",
    );
  const file = path.join(process.cwd(), ".local", "state.json");
  await mkdir(path.dirname(file), { recursive: true });
  let state: State;
  try {
    state = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      state = initialState();
    else throw error;
  }
  const result = await fn(state);
  const temp = file + ".tmp";
  await writeFile(temp, JSON.stringify(state, null, 2));
  await rename(temp, file);
  return result;
}
export function transact<T>(fn: (state: State) => T | Promise<T>): Promise<T> {
  const run = (globalStore.mktQueue ?? Promise.resolve()).then(() =>
    operation(fn),
  );
  globalStore.mktQueue = run.catch(() => {});
  return run;
}
