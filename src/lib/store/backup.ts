/**
 * Backups and restores for the SQLite store. Postgres is handled by the
 * scripts with pg_dump and psql; these functions are the testable part.
 */
import { DatabaseSync } from "node:sqlite";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { basename, join } from "node:path";

/** A consistent snapshot of a live SQLite database into `dir`; returns the file path. */
export function backupSqlite(dbPath: string, dir: string, now = new Date()): string {
  if (!existsSync(dbPath)) throw new Error(`No database at ${dbPath}.`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `${basename(dbPath, ".sqlite")}-${stamp}.sqlite`);
  const db = new DatabaseSync(dbPath);
  try {
    // VACUUM INTO writes a complete, compact copy including WAL contents.
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  return file;
}

/** Replace the live database with a backup; the current file is kept as a pre-restore backup. */
export function restoreSqlite(backupFile: string, dbPath: string, dir: string): string {
  if (!existsSync(backupFile)) throw new Error(`No backup at ${backupFile}.`);
  const probe = new DatabaseSync(backupFile, { readOnly: true });
  try {
    const row = probe.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    };
    if (row.integrity_check !== "ok")
      throw new Error("Backup failed its integrity check.");
  } finally {
    probe.close();
  }
  let kept = "";
  if (existsSync(dbPath)) kept = backupSqlite(dbPath, dir);
  for (const suffix of ["-wal", "-shm"]) {
    const side = dbPath + suffix;
    if (existsSync(side)) copyFileSync(side, side + ".pre-restore");
  }
  copyFileSync(backupFile, dbPath);
  // A restored file must not be paired with the old WAL.
  for (const suffix of ["-wal", "-shm"]) {
    const side = dbPath + suffix;
    if (existsSync(side)) unlinkSync(side);
  }
  return kept;
}

export function listBackups(dir: string): { file: string; bytes: number; at: Date }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sqlite"))
    .map((f) => {
      const file = join(dir, f);
      const s = statSync(file);
      return { file, bytes: s.size, at: s.mtime };
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}
