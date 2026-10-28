import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "../config";
import type { Param, Sql } from "./sql";

export async function openSqlite(path?: string): Promise<Sql> {
  const file = path ?? resolve(config().PROOFHOLD_DATA_DIR, "proofhold.sqlite");
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(file);
  database.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON",
  );
  const bind = (params: Param[] = []) =>
    params.map((p) =>
      p instanceof Uint8Array && !Buffer.isBuffer(p) ? Buffer.from(p) : p,
    );
  return {
    dialect: "sqlite",
    async run(sql, params) {
      const result = database.prepare(sql).run(...(bind(params) as never[]));
      return { changes: Number(result.changes) };
    },
    async get(sql, params) {
      return database.prepare(sql).get(...(bind(params) as never[])) as never;
    },
    async all(sql, params) {
      return database.prepare(sql).all(...(bind(params) as never[])) as never;
    },
    async close() {
      database.close();
    },
  };
}
