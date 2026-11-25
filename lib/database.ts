import { Pool } from "pg";

const shared = globalThis as typeof globalThis & { mktPool?: Pool };

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

// Only imported by server routes. Never expose DATABASE_URL to a client bundle.
export function database() {
  const raw = databaseUrl();
  if (!raw) throw new Error("DATABASE_URL is required");
  if (shared.mktPool) return shared.mktPool;
  let connectionString = raw;
  let ssl: { rejectUnauthorized: boolean } | undefined;
  try {
    const parsed = new URL(raw);
    const isRemote =
      parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1";
    if (isRemote || process.env.VERCEL) {
      parsed.searchParams.delete("sslmode");
      connectionString = parsed.toString();
      ssl = { rejectUnauthorized: false };
    }
  } catch {
    if (process.env.VERCEL) ssl = { rejectUnauthorized: false };
  }
  return (shared.mktPool = new Pool({
    connectionString,
    ssl,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    application_name: "saoviet-marketing-hub",
  }));
}
