/**
 * The decision engine. A pure function from (test, checks, buyer response,
 * time) to a money outcome. Nothing here calls PayPal or a model; the service
 * layer applies what this returns.
 */
import type { AcceptanceTest } from "../domain/test";
import type { CheckResult } from "../domain/proofhold";

export type Effective = "pass" | "fail" | "unresolved" | "pending";

export interface PredicateStanding {
  predicateId: string;
  text: string;
  mustPass: boolean;
  effective: Effective;
  source: CheckResult["source"] | null;
  verdict: CheckResult["verdict"] | null;
  confidence: number | null;
  reasons: string[];
  belowThreshold: boolean;
}

export type Outcome =
  | { kind: "release"; fraction: 1; reason: string }
  | { kind: "release_partial"; fraction: number; reason: string; rule: string[] }
  | { kind: "wait"; reason: string; releasesOnSilence: boolean }
  | { kind: "blocked"; reason: string; blocking: string[] }
  | { kind: "review"; reason: string };

export interface DecisionInput {
  test: AcceptanceTest;
  /** Checks from the latest round only. */
  checks: CheckResult[];
  buyerResponse: "confirmed" | "objected" | null;
  silenceWindowEnded: boolean;
  confidenceThreshold: number;
}

export interface Decision {
  outcome: Outcome;
  standings: PredicateStanding[];
  summary: string;
}

/** Pick the check that decides a predicate: buyer > examiner > validator, latest wins. */
export function latestCheckFor(
  checks: CheckResult[],
  predicateId: string,
): CheckResult | undefined {
  const rank = { buyer: 3, examiner: 2, tracking: 1, validator: 1 } as const;
  return checks
    .filter((c) => c.predicateId === predicateId)
    .sort(
      (a, b) => rank[b.source] - rank[a.source] || b.createdAt.localeCompare(a.createdAt),
    )[0];
}

export function standings(input: DecisionInput): PredicateStanding[] {
  return input.test.predicates.map((p) => {
    const c = latestCheckFor(input.checks, p.id);
    let effective: Effective = "pending";
    let belowThreshold = false;
    if (c) {
      if (c.verdict === "pass") {
        if (c.source === "examiner" && (c.confidence ?? 0) < input.confidenceThreshold) {
          effective = "unresolved";
          belowThreshold = true;
        } else effective = "pass";
      } else if (c.verdict === "fail") effective = "fail";
      else if (c.verdict === "abstain") effective = "unresolved";
      else effective = "pending";
    }
    return {
      predicateId: p.id,
      text: p.text,
      mustPass: p.must_pass,
      effective,
      source: c?.source ?? null,
      verdict: c?.verdict ?? null,
      confidence: c?.confidence ?? null,
      reasons: c?.reasons ?? [],
      belowThreshold,
    };
  });
}

export function decide(input: DecisionInput): Decision {
  const s = standings(input);
  const must = s.filter((x) => x.mustPass);
  const allMustPass = must.every((x) => x.effective === "pass");
  const blocking = must.filter((x) => x.effective !== "pass");

  if (input.buyerResponse === "objected") {
    return {
      outcome: { kind: "review", reason: "The buyer objected within the window." },
      standings: s,
      summary:
        "Buyer objected. The seller can propose a partial release or end the hold.",
    };
  }
  if (input.buyerResponse === "confirmed") {
    return {
      outcome: {
        kind: "release",
        fraction: 1,
        reason: "The buyer confirmed the delivery.",
      },
      standings: s,
      summary: "Buyer confirmed. Full release.",
    };
  }
  if (allMustPass) {
    if (input.silenceWindowEnded) {
      return {
        outcome: {
          kind: "release",
          fraction: 1,
          reason:
            "Every must-pass check passed and the buyer did not object within the window.",
        },
        standings: s,
        summary: "All checks passed; the window closed without objection. Full release.",
      };
    }
    return {
      outcome: {
        kind: "wait",
        reason:
          "Every must-pass check passed. Waiting for the buyer or the end of the window.",
        releasesOnSilence: true,
      },
      standings: s,
      summary: "All checks passed. Releases when the buyer confirms or the window ends.",
    };
  }

  // Partial release: the first rule whose predicates all pass.
  for (const rule of input.test.rules.partial_release) {
    const ok = rule.when_passed.every(
      (id) => s.find((x) => x.predicateId === id)?.effective === "pass",
    );
    if (!ok) continue;
    if (input.silenceWindowEnded) {
      return {
        outcome: {
          kind: "release_partial",
          fraction: rule.fraction,
          rule: rule.when_passed,
          reason: `${describe(rule.when_passed, s)} passed; the buyer did not object within the window. Partial release of ${Math.round(rule.fraction * 100)}% per the agreed rule.`,
        },
        standings: s,
        summary: `Partial release of ${Math.round(rule.fraction * 100)}% under the agreed rule; the rest is returned.`,
      };
    }
    return {
      outcome: {
        kind: "wait",
        reason: `${describe(rule.when_passed, s)} passed. If the buyer does not object, ${Math.round(rule.fraction * 100)}% releases when the window ends.`,
        releasesOnSilence: true,
      },
      standings: s,
      summary: `Partial release of ${Math.round(rule.fraction * 100)}% pending the buyer window.`,
    };
  }

  const pendingOnly = blocking.every((x) => x.effective === "pending");
  if (pendingOnly) {
    return {
      outcome: {
        kind: "wait",
        reason: "Some checks are still running.",
        releasesOnSilence: false,
      },
      standings: s,
      summary: "Checks in progress.",
    };
  }
  return {
    outcome: {
      kind: "blocked",
      reason:
        "Release is blocked until the buyer confirms: " +
        blocking.map(explain).join("; ") +
        ".",
      blocking: blocking.map((x) => x.predicateId),
    },
    standings: s,
    summary: "Release blocked. The buyer can still confirm, or the seller can resubmit.",
  };
}

function describe(ids: string[], s: PredicateStanding[]): string {
  return ids
    .map((id) => `"${s.find((x) => x.predicateId === id)?.text ?? id}"`)
    .join(", ");
}

function explain(x: PredicateStanding): string {
  if (x.effective === "fail") return `"${x.text}" failed`;
  if (x.belowThreshold)
    return `the examiner was not confident enough on "${x.text}" (${Math.round((x.confidence ?? 0) * 100)}%)`;
  if (x.effective === "unresolved") return `the examiner abstained on "${x.text}"`;
  return `"${x.text}" is still pending`;
}
