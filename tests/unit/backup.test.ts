import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { backupSqlite, listBackups, restoreSqlite } from "../../src/lib/store/backup";

test("a backup is a complete copy and a restore brings the data back", () => {
  const dir = mkdtempSync(join(tmpdir(), "ph-backup-"));
  const dbPath = join(dir, "proofhold.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('one'), ('two')",
  );
  const backups = join(dir, "backups");
  const file = backupSqlite(dbPath, backups, new Date("2026-11-01T10:00:00Z"));
  assert.ok(existsSync(file));
  assert.match(file, /proofhold-2026-11-01T10-00-00-000Z\.sqlite$/);
  db.exec("DELETE FROM t");
  assert.equal((db.prepare("SELECT count(*) AS n FROM t").get() as { n: number }).n, 0);
  db.close();

  const kept = restoreSqlite(file, dbPath, backups);
  assert.ok(existsSync(kept), "the pre-restore state is kept");
  const restored = new DatabaseSync(dbPath);
  assert.equal(
    (restored.prepare("SELECT count(*) AS n FROM t").get() as { n: number }).n,
    2,
  );
  restored.close();
  assert.equal(listBackups(backups).length, 2);
});

test("restoring a corrupt file is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "ph-backup-"));
  const bad = join(dir, "bad.sqlite");
  writeFileSync(bad, "not a database");
  assert.throws(() =>
    restoreSqlite(bad, join(dir, "proofhold.sqlite"), join(dir, "backups")),
  );
});
