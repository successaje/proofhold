/**
 * Back up the database.
 *
 *   npm run backup
 *
 * SQLite: a consistent snapshot under <PROOFHOLD_DATA_DIR>/backups/.
 * Postgres: pg_dump (custom format) into the same directory; needs pg_dump on PATH.
 */
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { config } = await import("../src/lib/config");
const { backupSqlite, listBackups } = await import("../src/lib/store/backup");

const c = config();
const dir = resolve(c.PROOFHOLD_DATA_DIR, "backups");
if (c.PROOFHOLD_STORE === "postgres") {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = resolve(
    dir,
    `proofhold-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`,
  );
  const r = spawnSync("pg_dump", ["--format=custom", "--file", file, c.DATABASE_URL!], {
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error("pg_dump failed; is it installed and is DATABASE_URL reachable?");
    process.exit(1);
  }
  console.log(`Backup written: ${file}`);
} else {
  const file = backupSqlite(resolve(c.PROOFHOLD_DATA_DIR, "proofhold.sqlite"), dir);
  console.log(`Backup written: ${file}`);
  const all = listBackups(dir);
  console.log(`${all.length} backup${all.length === 1 ? "" : "s"} in ${dir}`);
}
