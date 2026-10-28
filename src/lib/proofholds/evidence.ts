/**
 * Evidence intake and checking.
 *
 * submit → validators (sync) → examiner (async, via `runExaminer`) → decide.
 * Every round of checks is numbered so the history shows resubmissions.
 */
import { createHash } from "node:crypto";
import { config } from "../config";
import { decide, type Decision } from "../decision/decide";
import type { Proofhold } from "../domain/proofhold";
import { examine, judgementPredicates } from "../examiner/examine";
import { aiAvailable } from "../ai/client";
import {
  addEvidence,
  appendAudit,
  getEvidenceBytes,
  latestRound,
  listChecks,
  listEvidence,
  recordCheck,
  updateProofhold,
} from "../store/repos";
import type { Sql } from "../store/sql";
import { imageMeta, sniffMime } from "../validators/images";
import { carrierOptions, runValidators, type ValidationContext } from "../validators/run";
import { note, ProofholdError, requireStatus, transition } from "./lifecycle";
import { release } from "./release";

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_FILES = 12;

export async function addFile(
  sql: Sql,
  ph: Proofhold,
  file: { name: string; bytes: Uint8Array; declaredMime?: string | null },
) {
  requireStatus(
    ph,
    ["held", "awaiting_buyer", "in_review", "checking"],
    "Uploading evidence",
  );
  if (file.bytes.byteLength === 0) throw new ProofholdError("That file is empty.");
  if (file.bytes.byteLength > MAX_FILE_BYTES)
    throw new ProofholdError("Files are limited to 8 MB each.");
  const existing = await listEvidence(sql, ph.id);
  if (existing.filter((e) => e.kind === "file").length >= MAX_FILES)
    throw new ProofholdError(`At most ${MAX_FILES} files per proofhold.`);
  const mime = sniffMime(file.bytes, file.name) ?? file.declaredMime ?? null;
  const meta = imageMeta(file.bytes, mime);
  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  const item = await addEvidence(sql, {
    proofholdId: ph.id,
    kind: "file",
    name: file.name.replace(/[\\/]/g, "_").slice(0, 180),
    mime,
    bytes: file.bytes,
    sha256,
    metadata: meta ? { ...meta } : {},
  });
  await appendAudit(sql, ph.id, "evidence_added", {
    evidenceId: item.id,
    name: item.name,
    mime,
    sha256,
    size: item.size,
  });
  return item;
}

export async function removeFile(sql: Sql, ph: Proofhold, evidenceId: string) {
  requireStatus(ph, ["held", "awaiting_buyer", "in_review"], "Removing evidence");
  const items = await listEvidence(sql, ph.id);
  const item = items.find((e) => e.id === evidenceId);
  if (!item) throw new ProofholdError("Evidence not found", 404);
  await (await import("../store/repos")).deleteEvidence(sql, evidenceId);
  await appendAudit(sql, ph.id, "evidence_removed", { evidenceId, name: item.name });
}

export async function addTracking(
  sql: Sql,
  ph: Proofhold,
  input: { carrier: string; number: string },
) {
  requireStatus(
    ph,
    ["held", "awaiting_buyer", "in_review", "checking"],
    "Adding tracking",
  );
  const carrier = input.carrier.toUpperCase();
  if (!carrierOptions.includes(carrier)) throw new ProofholdError("Unknown carrier.");
  const number = input.number.trim();
  if (number.length < 4 || number.length > 60)
    throw new ProofholdError("Enter the tracking number.");
  const item = await addEvidence(sql, {
    proofholdId: ph.id,
    kind: "tracking",
    name: `${carrier} ${number}`,
    metadata: { carrier, number },
  });
  await appendAudit(sql, ph.id, "tracking_added", {
    evidenceId: item.id,
    carrier,
    number,
  });
  return item;
}

export async function buildContext(sql: Sql, ph: Proofhold): Promise<ValidationContext> {
  const items = await listEvidence(sql, ph.id);
  const tracking = items.filter((e) => e.kind === "tracking").pop();
  return {
    files: items
      .filter((e) => e.kind === "file")
      .map((e) => ({
        name: e.name,
        mime: e.mime,
        size: e.size,
        meta: e.metadata.format ? (e.metadata as never) : null,
        createdAt: e.createdAt,
      })),
    tracking: tracking
      ? {
          carrier: String(tracking.metadata.carrier),
          number: String(tracking.metadata.number),
          recordedAt: tracking.createdAt,
        }
      : null,
    buyerConfirmed:
      ph.buyerResponse === "confirmed"
        ? true
        : ph.buyerResponse === "objected"
          ? false
          : null,
    submittedAt: ph.evidenceSubmittedAt ?? new Date().toISOString(),
  };
}

/**
 * The seller says "this is my delivery". Runs validators now and returns.
 * The examiner runs afterwards through `runExaminer` (route `after()` or the scheduler).
 */
export async function submit(
  sql: Sql,
  ph: Proofhold,
  sellerNote?: string | null,
): Promise<{ proofhold: Proofhold; round: number; needsExaminer: boolean }> {
  requireStatus(ph, ["held", "awaiting_buyer", "in_review"], "Submitting evidence");
  const items = await listEvidence(sql, ph.id);
  if (items.length === 0)
    throw new ProofholdError("Add at least one file or a tracking number first.");
  const now = new Date().toISOString();
  const round = (await latestRound(sql, ph.id)) + 1;
  let current = await transition(
    sql,
    ph,
    "checking",
    {
      evidenceSubmittedAt: now,
      buyerResponse: null,
      buyerRespondedAt: null,
      offerCents: null,
      offerNote: null,
      silenceWindowEndsAt: null,
    },
    {
      type: "evidence_submitted",
      data: {
        round,
        items: items.map((e) => ({ id: e.id, name: e.name, sha256: e.sha256 })),
        note: sellerNote ?? null,
      },
    },
  );
  if (sellerNote)
    await (
      await import("../store/repos")
    ).addMessage(sql, { proofholdId: ph.id, author: "seller", body: sellerNote });
  const ctx = await buildContext(sql, current);
  const results = runValidators(current.test, ctx);
  for (const r of results) {
    if (
      r.verdict === "pending" &&
      current.test.predicates.find((p) => p.id === r.predicateId)?.check.kind ===
        "judgement"
    )
      continue;
    await recordCheck(sql, {
      proofholdId: ph.id,
      predicateId: r.predicateId,
      round,
      source:
        r.predicateId &&
        ctx.tracking &&
        current.test.predicates.find((p) => p.id === r.predicateId)?.check.kind ===
          "tracking_shipped"
          ? "tracking"
          : "validator",
      verdict: r.verdict,
      confidence: null,
      reasons: r.reasons,
      detail: r.detail,
    });
  }
  const needsExaminer = judgementPredicates(current.test).length > 0;
  if (!needsExaminer) current = await evaluate(sql, current);
  else if (!aiAvailable()) {
    for (const p of judgementPredicates(current.test)) {
      await recordCheck(sql, {
        proofholdId: ph.id,
        predicateId: p.id,
        round,
        source: "examiner",
        verdict: "abstain",
        confidence: 0,
        reasons: [
          "Examiner unavailable: no ANTHROPIC_API_KEY configured. The buyer decides this line.",
        ],
        detail: { unavailable: true },
      });
    }
    current = await evaluate(sql, current);
  }
  return { proofhold: current, round, needsExaminer: needsExaminer && aiAvailable() };
}

/** Runs the examiner for the latest round, records verdicts, then evaluates. */
export async function runExaminer(sql: Sql, ph: Proofhold): Promise<Proofhold> {
  if (ph.status !== "checking") return ph;
  const round = await latestRound(sql, ph.id);
  const existing = await listChecks(sql, ph.id, round);
  const preds = judgementPredicates(ph.test);
  if (
    preds.every((p) =>
      existing.some((c) => c.predicateId === p.id && c.source === "examiner"),
    )
  )
    return evaluate(sql, ph);
  const items = (await listEvidence(sql, ph.id)).filter((e) => e.kind === "file");
  const files = [];
  for (const item of items) {
    const stored = await getEvidenceBytes(sql, item.id);
    files.push({
      name: item.name,
      mime: item.mime,
      size: item.size,
      bytes: stored?.bytes ?? null,
    });
  }
  const messages = await (await import("../store/repos")).listMessages(sql, ph.id);
  const sellerNote = messages.filter((m) => m.author === "seller").pop()?.body ?? null;
  let result;
  try {
    result = await examine({ brief: ph.brief, test: ph.test, files, sellerNote });
  } catch (error) {
    await appendAudit(sql, ph.id, "examiner_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    for (const p of preds) {
      await recordCheck(sql, {
        proofholdId: ph.id,
        predicateId: p.id,
        round,
        source: "examiner",
        verdict: "abstain",
        confidence: 0,
        reasons: ["The examiner could not run. The buyer decides this line."],
        detail: { error: error instanceof Error ? error.message : String(error) },
      });
    }
    return evaluate(sql, ph);
  }
  for (const v of result.verdicts) {
    await recordCheck(sql, {
      proofholdId: ph.id,
      predicateId: v.predicate_id,
      round,
      source: "examiner",
      verdict: v.verdict,
      confidence: v.confidence,
      reasons: v.reasons,
      detail: { whatWouldResolve: v.what_would_resolve, model: result.model },
    });
  }
  await appendAudit(sql, ph.id, "examined", {
    round,
    model: result.model,
    manifest: result.inputManifest,
    summary: result.evidenceSummary,
    verdicts: result.verdicts,
    usage: result.usage,
  });
  return evaluate(sql, ph);
}

export function silenceWindowEnd(ph: Proofhold, from: Date): string {
  const demo = config().DEMO_SILENCE_MINUTES;
  const ms = demo ? demo * 60_000 : ph.test.rules.silence_window_hours * 3_600_000;
  return new Date(from.getTime() + ms).toISOString();
}

/** Decide from the latest round and apply: open the buyer window, or release. */
export async function evaluate(
  sql: Sql,
  ph: Proofhold,
  now: Date = new Date(),
): Promise<Proofhold> {
  const round = await latestRound(sql, ph.id);
  const checks = await listChecks(sql, ph.id, round);
  const silenceEnded = Boolean(
    ph.silenceWindowEndsAt && Date.parse(ph.silenceWindowEndsAt) <= now.getTime(),
  );
  const decision = decide({
    test: ph.test,
    checks,
    buyerResponse: ph.buyerResponse,
    silenceWindowEnded: silenceEnded,
    confidenceThreshold: config().EXAMINER_CONFIDENCE_THRESHOLD,
  });
  return apply(sql, ph, decision);
}

export async function apply(
  sql: Sql,
  ph: Proofhold,
  decision: Decision,
): Promise<Proofhold> {
  const o = decision.outcome;
  const decisionRecord = {
    outcome: o,
    summary: decision.summary,
    standings: decision.standings,
    at: new Date().toISOString(),
  };
  switch (o.kind) {
    case "release":
      return release(sql, await noteDecision(sql, ph, decisionRecord), {
        amountCents: ph.amountCents - ph.releasedCents,
        final: true,
        actor: ph.buyerResponse === "confirmed" ? "buyer" : "system",
        rationale: { reason: o.reason, standings: decision.standings },
      });
    case "release_partial":
      return release(sql, await noteDecision(sql, ph, decisionRecord), {
        amountCents: Math.round(ph.amountCents * o.fraction),
        final: false,
        actor: "system",
        rationale: {
          reason: o.reason,
          rule: o.rule,
          fraction: o.fraction,
          standings: decision.standings,
        },
      });
    case "review": {
      if (ph.status === "in_review") return noteDecision(sql, ph, decisionRecord);
      return transition(
        sql,
        ph,
        "in_review",
        { decision: decisionRecord, silenceWindowEndsAt: null },
        { type: "decision", data: { outcome: o } },
      );
    }
    case "wait":
    case "blocked": {
      const windowEnd = ph.silenceWindowEndsAt ?? silenceWindowEnd(ph, new Date());
      const patch = {
        decision: decisionRecord,
        silenceWindowEndsAt:
          o.kind === "wait" && !o.releasesOnSilence ? ph.silenceWindowEndsAt : windowEnd,
      };
      if (ph.status === "awaiting_buyer") return updateProofhold(sql, ph.id, patch);
      if (ph.status === "checking")
        return transition(sql, ph, "awaiting_buyer", patch, {
          type: "decision",
          data: { outcome: o, silenceWindowEndsAt: patch.silenceWindowEndsAt },
        });
      return noteDecision(sql, ph, decisionRecord);
    }
  }
}

async function noteDecision(
  sql: Sql,
  ph: Proofhold,
  decisionRecord: Record<string, unknown>,
): Promise<Proofhold> {
  return note(
    sql,
    ph,
    "decision",
    { outcome: decisionRecord.outcome, summary: decisionRecord.summary },
    { decision: decisionRecord },
  );
}
