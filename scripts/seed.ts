/**
 * Seed a workspace with proofholds in every state a judge or a demo needs.
 *
 *   npm run seed                 # prints the workspace cookie and every link
 *
 * Works in simulated mode without any credentials. In sandbox mode only the
 * proposed and cancelled proofholds are created, because only a real buyer can
 * approve a hold.
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { seedWorkspace } = await import("./seed-lib");
const { closeDb } = await import("../src/lib/store/sql");

const s = await seedWorkspace();
console.log(`Seeded workspace ${s.workspaceId} for ${s.workspaceName} (${s.mode}).`);
console.log(
  `\nCookie for this workspace (browser devtools or curl):\n  ph_workspace=${s.cookie}\n`,
);
console.log(
  `Seller list: ${s.appUrl}/app   Settings (outbox): ${s.appUrl}/app/settings\n`,
);
for (const r of s.rows)
  console.log(
    `${r.state.padEnd(18)} ${r.title.padEnd(42)} ${s.appUrl}/app/h/${r.id}   buyer ${s.appUrl}/p/${r.token}`,
  );
await closeDb();
