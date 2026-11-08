/** Seeds a workspace and writes its links and cookie as JSON for the recording. */
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { seedWorkspace } = await import("../seed-lib");
const { closeDb } = await import("../../src/lib/store/sql");
const out = process.argv[2];
if (!out) throw new Error("usage: seed-json.ts <file>");
const s = await seedWorkspace();
writeFileSync(out, JSON.stringify(s, null, 2));
await closeDb();
console.log("seeded", s.workspaceId, s.rows.length, "proofholds");
