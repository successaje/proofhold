/**
 * Run the examiner over the labelled cases and report, per category:
 * pass / fail / abstain counts, agreement with the label, and the number
 * that matters most: false releases (label fail or abstain, examiner pass
 * at or above the release threshold).
 *
 *   npm run eval              # needs ANTHROPIC_API_KEY
 *   npm run eval -- --limit 6 # first six cases
 *
 * Writes eval/results.json. Paste the summary into the README as it is.
 */
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { config } = await import("../src/lib/config");
const { examine } = await import("../src/lib/examiner/examine");
const { cases } = await import("../eval/cases");

if (!config().ai.configured) {
  console.error("Set ANTHROPIC_API_KEY to run the eval.");
  process.exit(1);
}

const limitArg = process.argv.indexOf("--limit");
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : cases.length;
const threshold = config().EXAMINER_CONFIDENCE_THRESHOLD;
const selected = cases.slice(0, limit);

interface Row {
  id: string;
  category: string;
  expected: string;
  verdict: string;
  confidence: number;
  agrees: boolean;
  wouldRelease: boolean;
  falseRelease: boolean;
  reasons: string[];
}

const rows: Row[] = [];
for (const c of selected) {
  const started = Date.now();
  const result = await examine({
    brief: c.brief,
    test: {
      version: 1,
      summary: c.brief.slice(0, 120),
      predicates: [
        {
          id: "p1",
          text: c.predicate,
          evidence: "judgement",
          must_pass: true,
          check: { kind: "judgement", criteria: c.criteria },
        },
      ],
      rules: { silence_window_hours: 72, partial_release: [] },
      unclear: [],
    },
    files: c.files.map((f) => ({
      name: f.name,
      mime: f.mime,
      size: f.bytes.byteLength,
      bytes: f.bytes,
    })),
  });
  const v = result.verdicts[0]!;
  const wouldRelease = v.verdict === "pass" && v.confidence >= threshold;
  const row: Row = {
    id: c.id,
    category: c.category,
    expected: c.expected,
    verdict: v.verdict,
    confidence: v.confidence,
    agrees: v.verdict === c.expected,
    wouldRelease,
    falseRelease: wouldRelease && c.expected !== "pass",
    reasons: v.reasons,
  };
  rows.push(row);
  console.log(
    `${row.agrees ? "✓" : "✗"} ${c.id.padEnd(9)} expected ${c.expected.padEnd(7)} got ${v.verdict.padEnd(7)} ${Math.round(v.confidence * 100)}%${row.falseRelease ? "  FALSE RELEASE" : ""}  (${Date.now() - started} ms)`,
  );
}

const categories = [...new Set(rows.map((r) => r.category))];
const summary = categories.map((cat) => {
  const rs = rows.filter((r) => r.category === cat);
  return {
    category: cat,
    cases: rs.length,
    pass: rs.filter((r) => r.verdict === "pass").length,
    fail: rs.filter((r) => r.verdict === "fail").length,
    abstain: rs.filter((r) => r.verdict === "abstain").length,
    agreement: rs.filter((r) => r.agrees).length,
    falseReleases: rs.filter((r) => r.falseRelease).length,
    missedReleases: rs.filter((r) => r.expected === "pass" && !r.wouldRelease).length,
  };
});
const total = {
  category: "all",
  cases: rows.length,
  pass: rows.filter((r) => r.verdict === "pass").length,
  fail: rows.filter((r) => r.verdict === "fail").length,
  abstain: rows.filter((r) => r.verdict === "abstain").length,
  agreement: rows.filter((r) => r.agrees).length,
  falseReleases: rows.filter((r) => r.falseRelease).length,
  missedReleases: rows.filter((r) => r.expected === "pass" && !r.wouldRelease).length,
};

console.log(
  "\n| Category | Cases | Agree | Pass | Fail | Abstain | False releases | Missed releases |",
);
console.log("|---|---|---|---|---|---|---|---|");
for (const s of [...summary, total]) {
  console.log(
    `| ${s.category} | ${s.cases} | ${s.agreement} | ${s.pass} | ${s.fail} | ${s.abstain} | ${s.falseReleases} | ${s.missedReleases} |`,
  );
}
writeFileSync(
  "eval/results.json",
  JSON.stringify(
    {
      model: config().ANTHROPIC_MODEL,
      threshold,
      at: new Date().toISOString(),
      summary: [...summary, total],
      rows,
    },
    null,
    2,
  ),
);
console.log(
  `\nModel ${config().ANTHROPIC_MODEL}, threshold ${threshold}. Written to eval/results.json.`,
);
