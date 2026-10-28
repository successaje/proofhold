import { Pool } from "pg";
import { toPostgresPlaceholders, type Param, type Sql } from "./sql";

export async function openPostgres(connectionString: string): Promise<Sql> {
  if (!/^postgres(?:ql)?:\/\//.test(connectionString))
    throw new Error("DATABASE_URL must be a postgres:// connection string.");
  const pool = new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    query_timeout: 20_000,
  });
  pool.on("error", () => {
    console.error("An idle database connection closed; the pool will reconnect.");
  });
  const normalise = (params: Param[] = []) =>
    params.map((p) =>
      p instanceof Uint8Array && !Buffer.isBuffer(p) ? Buffer.from(p) : p,
    );
  return {
    dialect: "postgres",
    async run(sql, params) {
      const result = await pool.query(toPostgresPlaceholders(sql), normalise(params));
      return { changes: result.rowCount ?? 0 };
    },
    async get(sql, params) {
      const result = await pool.query(toPostgresPlaceholders(sql), normalise(params));
      return result.rows[0] as never;
    },
    async all(sql, params) {
      const result = await pool.query(toPostgresPlaceholders(sql), normalise(params));
      return result.rows as never;
    },
    async close() {
      await pool.end();
    },
  };
}
