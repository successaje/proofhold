/**
 * Reset local data. Backs up first, then removes the SQLite database so the
 * next start begins empty. Never touches Postgres: a hosted database is reset
 * by its operator with their own tooling, on purpose.
 *
 *   npm run reset -- --yes
 */
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { config } = await import("../src/lib/config");
const { backupSqlite } = await import("../src/lib/store/backup");

const c = config();
if (c.PROOFHOLD_STORE === "postgres") {
  console.error(
    "Refusing to reset a Postgres database. Drop and recreate it yourself if you mean it.",
  );
  process.exit(1);
}
if (!process.argv.includes("--yes")) {
  console.error(
    "This deletes the local database (after a backup). Re-run with --yes to proceed.",
  );
  process.exit(1);
}
const dbPath = resolve(c.PROOFHOLD_DATA_DIR, "proofhold.sqlite");
if (!existsSync(dbPath)) {
  console.log("Nothing to reset.");
  process.exit(0);
}
const kept = backupSqlite(dbPath, resolve(c.PROOFHOLD_DATA_DIR, "backups"));
for (const f of [dbPath, dbPath + "-wal", dbPath + "-shm"])
  if (existsSync(f)) unlinkSync(f);
console.log(`Local database removed. A backup is at ${kept}.`);
