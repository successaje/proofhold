/**
 * A minimal SQL abstraction over node:sqlite and pg.
 *
 * Queries are written with `?` placeholders. For Postgres they are rewritten
 * to `$1..$n`. JSON is stored as TEXT, timestamps as ISO strings, booleans as
 * integers, so one schema serves both dialects.
 */
import { config } from "../config";
import { migrations } from "./migrations";

export type Param = string | number | null | Uint8Array | Buffer;

export interface Sql {
  readonly dialect: "sqlite" | "postgres";
  run(sql: string, params?: Param[]): Promise<{ changes: number }>;
  get<T = Record<string, unknown>>(sql: string, params?: Param[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(sql: string, params?: Param[]): Promise<T[]>;
  close(): Promise<void>;
}

let instance: Promise<Sql> | undefined;

/** The process-wide database, migrated on first use. */
export function db(): Promise<Sql> {
  instance ??= open().catch((error) => {
    instance = undefined;
    throw error;
  });
  return instance;
}

/** Test hook: open an isolated database (SQLite path or ":memory:"). */
export async function openDatabase(options?: { sqlitePath?: string }): Promise<Sql> {
  const sql =
    config().PROOFHOLD_STORE === "postgres" && !options?.sqlitePath
      ? await (await import("./postgres")).openPostgres(config().DATABASE_URL!)
      : await (await import("./sqlite")).openSqlite(options?.sqlitePath);
  await migrate(sql);
  return sql;
}

async function open(): Promise<Sql> {
  return openDatabase();
}

export async function migrate(sql: Sql): Promise<void> {
  await sql.run(
    "CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (await sql.all<{ name: string }>("SELECT name FROM migrations")).map((r) => r.name),
  );
  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    const body = m.sql.replaceAll(
      "BLOB_TYPE",
      sql.dialect === "postgres" ? "BYTEA" : "BLOB",
    );
    for (const statement of splitStatements(body)) await sql.run(statement);
    await sql.run("INSERT INTO migrations (name, applied_at) VALUES (?, ?)", [
      m.name,
      new Date().toISOString(),
    ]);
  }
}

function splitStatements(body: string): string[] {
  return body
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function toPostgresPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Close the shared connection (used by scripts and tests). */
export async function closeDb(): Promise<void> {
  if (!instance) return;
  const sql = await instance;
  instance = undefined;
  await sql.close();
}
