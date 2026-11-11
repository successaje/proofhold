#!/usr/bin/env node
/**
 * Put one secret into .env.local without it appearing on screen, in shell
 * history or in a chat.
 *
 *   node scripts/set-secret.mjs GEMINI_API_KEY
 *   node scripts/set-secret.mjs PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET
 *
 * Prompts for each name with hidden input, then replaces that line in
 * .env.local (or appends it). Prints only the name and the length saved.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../.env.local", import.meta.url));
const names = process.argv.slice(2);
if (names.length === 0 || names.some((n) => !/^[A-Z][A-Z0-9_]*$/.test(n))) {
  console.error("Usage: node scripts/set-secret.mjs NAME [NAME…]   (names in CAPITALS)");
  process.exit(1);
}

function ask(name) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(`Paste ${name}, then press Enter (input is hidden): `);
    if (!stdin.isTTY) {
      // Piped input: read one line.
      let buf = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (d) => (buf += d));
      stdin.on("end", () => resolve(buf.split("\n")[0] ?? ""));
      return;
    }
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          return reject(new Error("Cancelled; nothing was changed."));
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

let text = existsSync(file) ? readFileSync(file, "utf8") : "";
try {
  for (const name of names) {
    const value = (await ask(name)).trim().replace(/^["']|["']$/g, "");
    if (!value) {
      console.log(`  ${name}: left unchanged (nothing entered)`);
      continue;
    }
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^#?\\s*${name}=.*$`, "m");
    text = pattern.test(text)
      ? text.replace(pattern, () => line)
      : `${text.replace(/\n*$/, "\n")}${line}\n`;
    console.log(`  ${name}: saved (${value.length} characters)`);
  }
  writeFileSync(file, text, { mode: 0o600 });
  console.log(`Written to ${file}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
