/**
 * Client-safe views of domain objects. Pages and API responses use these so
 * the browser never sees buyer tokens it should not, raw bytes, or secrets.
 */
import { config } from "./config";
import {
  formatAmount,
  statusMeta,
  type CheckResult,
  type Decision,
  type EvidenceItem,
  type Message,
  type Proofhold,
} from "./domain/proofhold";
import type { AuditEntry } from "./audit/chain";
import { aiAvailable } from "./ai/client";

export interface SystemInfo {
  paypalMode: "sandbox" | "simulated";
  aiAvailable: boolean;
  model: string;
  demoSilenceMinutes: number | null;
  appUrl: string;
}

export function systemInfo(): SystemInfo {
  const c = config();
  return {
    paypalMode: c.paypal.mode,
    aiAvailable: aiAvailable(),
    model: c.ANTHROPIC_MODEL,
    demoSilenceMinutes: c.DEMO_SILENCE_MINUTES ?? null,
    appUrl: c.APP_URL,
  };
}

export interface ProofholdView {
  id: string;
  title: string;
  kind: Proofhold["kind"];
  brief: string;
  amountCents: number;
  currency: string;
  amount: string;
  status: Proofhold["status"];
  statusLabel: string;
  statusTone: "neutral" | "held" | "pass" | "fail";
  statusSummary: string;
  test: Proofhold["test"];
  testHash: string;
  buyerEmail: string | null;
  buyerName: string | null;
  payerEmail: string | null;
  sellerAgreedAt: string | null;
  buyerAgreedAt: string | null;
  paypalOrderId: string | null;
  paypalAuthorizationId: string | null;
  authorizationExpiresAt: string | null;
  honorPeriodEndsAt: string | null;
  silenceWindowEndsAt: string | null;
  evidenceSubmittedAt: string | null;
  decidedAt: string | null;
  offerCents: number | null;
  offerNote: string | null;
  buyerResponse: Proofhold["buyerResponse"];
  decision: Proofhold["decision"];
  paypalDisputeId: string | null;
  releasedCents: number;
  reauthorizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function proofholdView(ph: Proofhold): ProofholdView {
  const meta = statusMeta[ph.status];
  return {
    id: ph.id,
    title: ph.title,
    kind: ph.kind,
    brief: ph.brief,
    amountCents: ph.amountCents,
    currency: ph.currency,
    amount: formatAmount(ph.amountCents, ph.currency),
    status: ph.status,
    statusLabel: meta.label,
    statusTone: meta.tone,
    statusSummary: meta.summary,
    test: ph.test,
    testHash: ph.testHash,
    buyerEmail: ph.buyerEmail,
    buyerName: ph.buyerName,
    payerEmail: ph.payerEmail,
    sellerAgreedAt: ph.sellerAgreedAt,
    buyerAgreedAt: ph.buyerAgreedAt,
    paypalOrderId: ph.paypalOrderId,
    paypalAuthorizationId: ph.paypalAuthorizationId,
    authorizationExpiresAt: ph.authorizationExpiresAt,
    honorPeriodEndsAt: ph.honorPeriodEndsAt,
    silenceWindowEndsAt: ph.silenceWindowEndsAt,
    evidenceSubmittedAt: ph.evidenceSubmittedAt,
    decidedAt: ph.decidedAt,
    offerCents: ph.offerCents,
    offerNote: ph.offerNote,
    buyerResponse: ph.buyerResponse,
    decision: ph.decision,
    paypalDisputeId: ph.paypalDisputeId,
    releasedCents: ph.releasedCents,
    reauthorizedAt: ph.reauthorizedAt,
    createdAt: ph.createdAt,
    updatedAt: ph.updatedAt,
  };
}

/** Seller-only extras: the share link. */
export function sellerView(ph: Proofhold) {
  return { ...proofholdView(ph), buyerUrl: `${config().APP_URL}/p/${ph.buyerToken}` };
}

export interface ProofholdDetail {
  proofhold: ProofholdView;
  evidence: EvidenceItem[];
  checks: CheckResult[];
  decisions: Decision[];
  messages: Message[];
  audit: AuditEntry[];
  system: SystemInfo;
}
