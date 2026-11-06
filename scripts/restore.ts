/**
 * Restore the database from a backup. Refuses to run without --yes, and keeps
 * a snapshot of the current database before replacing it.
 *
 *   npm run restore -- <backup-file> --yes
 *
 * Stop the app first: an open SQLite connection would keep writing to the old file.
 * Postgres: pg_restore --clean into DATABASE_URL (needs pg_restore on PATH).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { config } = await import("../src/lib/config");
const { restoreSqlite } = await import("../src/lib/store/backup");

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const yes = args.includes("--yes");
if (!file) {
  console.error("Usage: npm run restore -- <backup-file> --yes");
  process.exit(1);
}
if (!yes) {
  console.error(
    `This replaces the live database with ${file}. Re-run with --yes to proceed.`,
  );
  process.exit(1);
}
const c = config();
if (c.PROOFHOLD_STORE === "postgres") {
  const r = spawnSync(
    "pg_restore",
    ["--clean", "--if-exists", "--dbname", c.DATABASE_URL!, file],
    {
      stdio: "inherit",
    },
  );
  process.exit(r.status ?? 1);
}
const dbPath = resolve(c.PROOFHOLD_DATA_DIR, "proofhold.sqlite");
const kept = restoreSqlite(
  resolve(file),
  dbPath,
  resolve(c.PROOFHOLD_DATA_DIR, "backups"),
);
console.log(`Restored ${file} to ${dbPath}.`);
if (kept) console.log(`The previous database was kept at ${kept}.`);
