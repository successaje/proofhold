/**
 * Start Proofhold locally with SQLite storage.
 *
 *   npm run local
 *
 * Reads .env.local when present. PayPal and Anthropic credentials are optional:
 * without them the app runs the simulated PayPal client and reports the AI
 * compiler and examiner as unavailable.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);

if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error("Proofhold requires Node.js 24 or newer.");
  process.exit(1);
}
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const env = {
  ...process.env,
  PROOFHOLD_STORE: process.env.PROOFHOLD_STORE || "sqlite",
  NEXT_TELEMETRY_DISABLED: "1",
};
const port = env.PORT || "3200";
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
  console.error("Choose a PORT between 1024 and 65535.");
  process.exit(1);
}
env.APP_URL ||= `http://127.0.0.1:${port}`;

const paypal =
  env.PAYPAL_MODE === "sandbox" && env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET
    ? "PayPal sandbox (api-m.sandbox.paypal.com)"
    : "simulated PayPal (set PAYPAL_MODE=sandbox and credentials to use the sandbox)";
const ai = env.ANTHROPIC_API_KEY
  ? `Anthropic ${env.ANTHROPIC_MODEL || "claude-sonnet-5-5"}`
  : "unavailable (set ANTHROPIC_API_KEY to enable the compiler and examiner)";

console.log(`Proofhold  ${env.APP_URL}/app`);
console.log(`Storage    local SQLite under .data/`);
console.log(`PayPal     ${paypal}`);
console.log(`AI         ${ai}`);

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port],
  { env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Could not start the local application. Run npm ci and try again.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
