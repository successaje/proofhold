import { test } from "node:test";
import assert from "node:assert/strict";
import { examineSimulated, SIMULATED_MODEL } from "../../src/lib/examiner/simulated";
import { sampleTest } from "./domain.test";
import { makePng } from "./validators.test";

const test_ = {
  ...sampleTest,
  predicates: [
    ...sampleTest.predicates,
    {
      id: "pj",
      text: "Concepts are minimal, two colours, and read as coastal",
      evidence: "judgement" as const,
      must_pass: true,
      check: {
        kind: "judgement" as const,
        criteria: "Each logo concept uses at most two colours and evokes the coast.",
      },
    },
  ],
};
const input = (
  files: { name: string; mime: string | null; bytes: Uint8Array | null }[],
) => ({
  brief: "Three logo concepts",
  test: test_,
  files: files.map((f) => ({ ...f, size: f.bytes?.byteLength ?? 0 })),
});

test("no readable files: abstain, labelled as simulated", () => {
  const r = examineSimulated(input([]));
  assert.equal(r.model, SIMULATED_MODEL);
  assert.equal(
    r.verdicts.length,
    test_.predicates.filter((p) => p.check.kind === "judgement").length,
  );
  const v = r.verdicts.find((x) => x.predicate_id === "pj")!;
  assert.equal(v.verdict, "abstain");
  assert.match(v.reasons[0]!, /^Simulated examiner:/);
});

test("readable images for a visual criterion pass with a stated confidence", () => {
  const r = examineSimulated(
    input([
      { name: "coastal-logo-a.png", mime: "image/png", bytes: makePng(800, 600, 300) },
      { name: "coastal-logo-b.png", mime: "image/png", bytes: makePng(800, 600, 300) },
    ]),
  );
  const v = r.verdicts.find((x) => x.predicate_id === "pj")!;
  assert.equal(v.verdict, "pass");
  assert.ok(v.confidence >= 0.8);
  assert.match(v.reasons.join(" "), /2 readable images/);
});

test("placeholder content fails; tiny images abstain", () => {
  const txt = new TextEncoder().encode("Lorem ipsum dolor sit amet");
  const r = examineSimulated(
    input([{ name: "notes.txt", mime: "text/plain", bytes: txt }]),
  );
  assert.equal(r.verdicts[0]!.verdict, "fail");
  const tiny = examineSimulated(
    input([{ name: "logo.png", mime: "image/png", bytes: makePng(16, 16, 72) }]),
  );
  assert.equal(tiny.verdicts[0]!.verdict, "abstain");
});
