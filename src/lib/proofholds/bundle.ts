/**
 * The evidence bundle: everything either party needs to show what was agreed,
 * what was submitted, what the checks said and what happened to the money.
 * It is what Proofhold files with PayPal when a dispute is opened.
 */
import { verifyChain } from "../audit/chain";
import type { Proofhold } from "../domain/proofhold";
import {
  listAudit,
  listChecks,
  listDecisions,
  listEvidence,
  listMessages,
} from "../store/repos";
import type { Sql } from "../store/sql";

export async function evidenceBundle(sql: Sql, ph: Proofhold) {
  const [evidence, checks, decisions, messages, audit] = await Promise.all([
    listEvidence(sql, ph.id),
    listChecks(sql, ph.id),
    listDecisions(sql, ph.id),
    listMessages(sql, ph.id),
    listAudit(sql, ph.id),
  ]);
  const broken = verifyChain(audit);
  return {
    format: "proofhold-evidence-bundle/1",
    generatedAt: new Date().toISOString(),
    proofhold: {
      id: ph.id,
      title: ph.title,
      kind: ph.kind,
      brief: ph.brief,
      amountCents: ph.amountCents,
      currency: ph.currency,
      status: ph.status,
      testHash: ph.testHash,
      sellerAgreedAt: ph.sellerAgreedAt,
      buyerAgreedAt: ph.buyerAgreedAt,
      paypal: {
        orderId: ph.paypalOrderId,
        authorizationId: ph.paypalAuthorizationId,
        authorizationExpiresAt: ph.authorizationExpiresAt,
        disputeId: ph.paypalDisputeId,
        trackerId: ph.paypalTrackerId,
      },
      releasedCents: ph.releasedCents,
    },
    acceptanceTest: ph.test,
    evidence: evidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      mime: e.mime,
      size: e.size,
      sha256: e.sha256,
      metadata: e.metadata,
      at: e.createdAt,
    })),
    checks,
    decisions,
    messages,
    audit: {
      entries: audit,
      intact: broken === -1,
      firstBrokenIndex: broken === -1 ? null : broken,
    },
  };
}

export function bundleSummaryText(
  bundle: Awaited<ReturnType<typeof evidenceBundle>>,
): string {
  const lines = [
    `Proofhold ${bundle.proofhold.id}: "${bundle.proofhold.title}"`,
    `Acceptance test hash ${bundle.proofhold.testHash} (bound to PayPal order ${bundle.proofhold.paypal.orderId ?? "n/a"} as custom_id).`,
    `Seller agreed ${bundle.proofhold.sellerAgreedAt ?? "n/a"}; buyer agreed ${bundle.proofhold.buyerAgreedAt ?? "n/a"}.`,
    "",
    "Checks:",
    ...bundle.acceptanceTest.predicates.map((p) => {
      const latest = bundle.checks.filter((c) => c.predicateId === p.id).pop();
      return `- ${p.text}: ${latest ? `${latest.verdict} (${latest.source}${latest.confidence !== null ? `, ${Math.round(latest.confidence * 100)}%` : ""}) ${latest.reasons.join("; ")}` : "no result"}`;
    }),
    "",
    `Evidence files: ${bundle.evidence.map((e) => `${e.name} sha256:${e.sha256 ?? "n/a"}`).join(", ") || "none"}`,
    `Decisions: ${bundle.decisions.map((d) => `${d.outcome} ${d.amountCents / 100} by ${d.actor}`).join("; ") || "none"}`,
    `Audit chain: ${bundle.audit.entries.length} entries, ${bundle.audit.intact ? "intact" : "BROKEN"}.`,
  ];
  return lines.join("\n");
}
