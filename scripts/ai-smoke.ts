/**
 * Prove the model provider end to end from the command line: compile one
 * brief, then have the examiner judge one image against one judgement line.
 *
 *   npx tsx scripts/ai-smoke.ts
 *
 * Reads .env.local. Needs ANTHROPIC_API_KEY or GEMINI_API_KEY. Two requests,
 * a few thousand tokens. Prints the provider, the model and what came back;
 * never prints the key.
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
// Judge with the model here even when the app is set to the simulation.
process.env.EXAMINER_MODE = "auto";

const { config } = await import("../src/lib/config");
const { compileBrief } = await import("../src/lib/compiler/compile");
const { examine } = await import("../src/lib/examiner/examine");
const { pngFixture } = await import("./png");

const ai = config().ai;
if (!ai.provider) {
  console.error("Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local first.");
  process.exit(1);
}
console.log(`Provider ${ai.provider}, model ${ai.model}\n`);

const brief =
  "Three logo concepts for Driftwood Café, a coastal coffee shop. PNG, at least 2000px wide, delivered by Friday 20 November 2026. The concepts should look clearly different from each other.";

console.log("1. Compiling a brief…");
const compiled = await compileBrief({
  brief,
  kind: "service",
  amountCents: 42000,
  currency: "USD",
  today: "2026-11-11",
});
if (compiled.source !== "ai") {
  console.error("   The compiler fell back to a starter test; the model was not used.");
  process.exit(1);
}
console.log(`   "${compiled.test.summary}"`);
for (const p of compiled.test.predicates)
  console.log(`   - [${p.check.kind}] ${p.text}${p.must_pass ? "" : " (optional)"}`);
console.log(
  `   tokens in ${compiled.usage?.inputTokens}, out ${compiled.usage?.outputTokens}\n`,
);

console.log("2. Examining one image against one judgement line…");
const png = pngFixture(2400, 1600, 300, 200);
const result = await examine({
  brief,
  test: {
    version: 1,
    summary: "Logo concepts for Driftwood Café",
    predicates: [
      {
        id: "p1",
        text: "The image is a finished logo concept for a coastal café",
        evidence: "judgement",
        must_pass: true,
        check: {
          kind: "judgement",
          criteria:
            "The image shows a recognisable logo (a mark, a wordmark or both) suited to a coastal café. A flat colour field or a placeholder is not a logo.",
        },
      },
    ],
    rules: { silence_window_hours: 72, partial_release: [] },
    unclear: [],
  },
  files: [{ name: "concept-1.png", mime: "image/png", size: png.byteLength, bytes: png }],
});
for (const v of result.verdicts) {
  console.log(`   ${v.predicate_id}: ${v.verdict} at ${Math.round(v.confidence * 100)}%`);
  for (const r of v.reasons) console.log(`     · ${r}`);
}
console.log(`   summary: ${result.evidenceSummary}`);
console.log(
  `   tokens in ${result.usage.inputTokens}, out ${result.usage.outputTokens}\n`,
);
console.log(
  "The fixture image is a plain colour field, so a sound examiner fails or abstains here. A confident pass would be a bad sign.",
);
