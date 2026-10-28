/**
 * Repositories: the only modules that write SQL for domain objects.
 * Each takes an explicit `Sql` so tests can run against an isolated database.
 */
import type { Sql } from "./sql";
import { newId, newToken, nowIso } from "../ids";
import { parseTest, type AcceptanceTest } from "../domain/test";
import type {
  CheckResult,
  CheckSource,
  Decision,
  EvidenceItem,
  Kind,
  Message,
  Outcome,
  Proofhold,
  Status,
  Verdict,
} from "../domain/proofhold";
import { entryHash, GENESIS, type AuditEntry } from "../audit/chain";

// ---------- workspaces ----------

export interface Workspace {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export async function createWorkspace(sql: Sql, input: { name: string; email: string }) {
  const ws: Workspace = {
    id: newId("ws"),
    name: input.name,
    email: input.email,
    createdAt: nowIso(),
  };
  await sql.run(
    "INSERT INTO workspaces (id, name, email, created_at) VALUES (?, ?, ?, ?)",
    [ws.id, ws.name, ws.email, ws.createdAt],
  );
  return ws;
}

export async function getWorkspace(sql: Sql, id: string): Promise<Workspace | undefined> {
  const row = await sql.get<{
    id: string;
    name: string;
    email: string;
    created_at: string;
  }>("SELECT * FROM workspaces WHERE id = ?", [id]);
  return row
    ? { id: row.id, name: row.name, email: row.email, createdAt: row.created_at }
    : undefined;
}

export async function updateWorkspace(
  sql: Sql,
  id: string,
  input: { name: string; email: string },
) {
  await sql.run("UPDATE workspaces SET name = ?, email = ? WHERE id = ?", [
    input.name,
    input.email,
    id,
  ]);
}

// ---------- proofholds ----------

interface ProofholdRow {
  id: string;
  workspace_id: string;
  buyer_token: string;
  title: string;
  kind: Kind;
  brief: string;
  amount_cents: number;
  currency: string;
  buyer_email: string | null;
  buyer_name: string | null;
  status: Status;
  test_json: string;
  test_hash: string;
  seller_agreed_at: string | null;
  buyer_agreed_at: string | null;
  paypal_order_id: string | null;
  paypal_authorization_id: string | null;
  authorization_expires_at: string | null;
  honor_period_ends_at: string | null;
  silence_window_ends_at: string | null;
  evidence_submitted_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProofhold(r: ProofholdRow): Proofhold {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    buyerToken: r.buyer_token,
    title: r.title,
    kind: r.kind,
    brief: r.brief,
    amountCents: Number(r.amount_cents),
    currency: r.currency,
    buyerEmail: r.buyer_email,
    buyerName: r.buyer_name,
    status: r.status,
    test: parseTest(JSON.parse(r.test_json)),
    testHash: r.test_hash,
    sellerAgreedAt: r.seller_agreed_at,
    buyerAgreedAt: r.buyer_agreed_at,
    paypalOrderId: r.paypal_order_id,
    paypalAuthorizationId: r.paypal_authorization_id,
    authorizationExpiresAt: r.authorization_expires_at,
    honorPeriodEndsAt: r.honor_period_ends_at,
    silenceWindowEndsAt: r.silence_window_ends_at,
    evidenceSubmittedAt: r.evidence_submitted_at,
    decidedAt: r.decided_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface NewProofhold {
  workspaceId: string;
  title: string;
  kind: Kind;
  brief: string;
  amountCents: number;
  currency: string;
  buyerEmail?: string | null;
  test: AcceptanceTest;
  testHash: string;
  status?: Status;
}

export async function createProofhold(sql: Sql, input: NewProofhold): Promise<Proofhold> {
  const now = nowIso();
  const id = newId("ph");
  await sql.run(
    `INSERT INTO proofholds (id, workspace_id, buyer_token, title, kind, brief, amount_cents, currency,
       buyer_email, status, test_json, test_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.workspaceId,
      newToken(),
      input.title,
      input.kind,
      input.brief,
      input.amountCents,
      input.currency,
      input.buyerEmail ?? null,
      input.status ?? "draft",
      JSON.stringify(input.test),
      input.testHash,
      now,
      now,
    ],
  );
  return (await getProofhold(sql, id))!;
}

export async function getProofhold(sql: Sql, id: string): Promise<Proofhold | undefined> {
  const row = await sql.get<ProofholdRow>("SELECT * FROM proofholds WHERE id = ?", [id]);
  return row ? rowToProofhold(row) : undefined;
}

export async function getProofholdByToken(
  sql: Sql,
  token: string,
): Promise<Proofhold | undefined> {
  const row = await sql.get<ProofholdRow>(
    "SELECT * FROM proofholds WHERE buyer_token = ?",
    [token],
  );
  return row ? rowToProofhold(row) : undefined;
}

export async function getProofholdByOrder(
  sql: Sql,
  orderId: string,
): Promise<Proofhold | undefined> {
  const row = await sql.get<ProofholdRow>(
    "SELECT * FROM proofholds WHERE paypal_order_id = ?",
    [orderId],
  );
  return row ? rowToProofhold(row) : undefined;
}

export async function getProofholdByAuthorization(sql: Sql, authorizationId: string) {
  const row = await sql.get<ProofholdRow>(
    "SELECT * FROM proofholds WHERE paypal_authorization_id = ?",
    [authorizationId],
  );
  return row ? rowToProofhold(row) : undefined;
}

export async function listProofholds(
  sql: Sql,
  workspaceId: string,
): Promise<Proofhold[]> {
  const rows = await sql.all<ProofholdRow>(
    "SELECT * FROM proofholds WHERE workspace_id = ? ORDER BY created_at DESC",
    [workspaceId],
  );
  return rows.map(rowToProofhold);
}

export async function listProofholdsByStatus(
  sql: Sql,
  statuses: Status[],
): Promise<Proofhold[]> {
  if (statuses.length === 0) return [];
  const rows = await sql.all<ProofholdRow>(
    `SELECT * FROM proofholds WHERE status IN (${statuses.map(() => "?").join(",")}) ORDER BY created_at`,
    statuses,
  );
  return rows.map(rowToProofhold);
}

type ProofholdPatch = Partial<
  Pick<
    Proofhold,
    | "title"
    | "brief"
    | "amountCents"
    | "currency"
    | "buyerEmail"
    | "buyerName"
    | "status"
    | "test"
    | "testHash"
    | "sellerAgreedAt"
    | "buyerAgreedAt"
    | "paypalOrderId"
    | "paypalAuthorizationId"
    | "authorizationExpiresAt"
    | "honorPeriodEndsAt"
    | "silenceWindowEndsAt"
    | "evidenceSubmittedAt"
    | "decidedAt"
  >
>;

const columnFor: Record<keyof ProofholdPatch, string> = {
  title: "title",
  brief: "brief",
  amountCents: "amount_cents",
  currency: "currency",
  buyerEmail: "buyer_email",
  buyerName: "buyer_name",
  status: "status",
  test: "test_json",
  testHash: "test_hash",
  sellerAgreedAt: "seller_agreed_at",
  buyerAgreedAt: "buyer_agreed_at",
  paypalOrderId: "paypal_order_id",
  paypalAuthorizationId: "paypal_authorization_id",
  authorizationExpiresAt: "authorization_expires_at",
  honorPeriodEndsAt: "honor_period_ends_at",
  silenceWindowEndsAt: "silence_window_ends_at",
  evidenceSubmittedAt: "evidence_submitted_at",
  decidedAt: "decided_at",
};

export async function updateProofhold(
  sql: Sql,
  id: string,
  patch: ProofholdPatch,
): Promise<Proofhold> {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(patch) as [keyof ProofholdPatch, unknown][]) {
    if (value === undefined) continue;
    sets.push(`${columnFor[key]} = ?`);
    params.push(
      key === "test" ? JSON.stringify(value) : (value as string | number | null),
    );
  }
  sets.push("updated_at = ?");
  params.push(nowIso());
  params.push(id);
  await sql.run(`UPDATE proofholds SET ${sets.join(", ")} WHERE id = ?`, params);
  return (await getProofhold(sql, id))!;
}

// ---------- evidence ----------

interface EvidenceRow {
  id: string;
  proofhold_id: string;
  kind: EvidenceItem["kind"];
  name: string;
  mime: string | null;
  size: number;
  sha256: string | null;
  metadata_json: string;
  note: string | null;
  created_at: string;
}

const evidenceColumns =
  "id, proofhold_id, kind, name, mime, size, sha256, metadata_json, note, created_at";

function rowToEvidence(r: EvidenceRow): EvidenceItem {
  return {
    id: r.id,
    proofholdId: r.proofhold_id,
    kind: r.kind,
    name: r.name,
    mime: r.mime,
    size: Number(r.size),
    sha256: r.sha256,
    metadata: JSON.parse(r.metadata_json),
    note: r.note,
    createdAt: r.created_at,
  };
}

export async function addEvidence(
  sql: Sql,
  input: {
    proofholdId: string;
    kind: EvidenceItem["kind"];
    name: string;
    mime?: string | null;
    bytes?: Uint8Array | null;
    sha256?: string | null;
    metadata?: Record<string, unknown>;
    note?: string | null;
  },
): Promise<EvidenceItem> {
  const id = newId("ev");
  await sql.run(
    `INSERT INTO evidence (id, proofhold_id, kind, name, mime, size, sha256, bytes, metadata_json, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.proofholdId,
      input.kind,
      input.name,
      input.mime ?? null,
      input.bytes?.byteLength ?? 0,
      input.sha256 ?? null,
      input.bytes ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.note ?? null,
      nowIso(),
    ],
  );
  const row = await sql.get<EvidenceRow>(
    `SELECT ${evidenceColumns} FROM evidence WHERE id = ?`,
    [id],
  );
  return rowToEvidence(row!);
}

export async function listEvidence(
  sql: Sql,
  proofholdId: string,
): Promise<EvidenceItem[]> {
  const rows = await sql.all<EvidenceRow>(
    `SELECT ${evidenceColumns} FROM evidence WHERE proofhold_id = ? ORDER BY created_at`,
    [proofholdId],
  );
  return rows.map(rowToEvidence);
}

export async function getEvidenceBytes(
  sql: Sql,
  id: string,
): Promise<{ item: EvidenceItem; bytes: Uint8Array | null } | undefined> {
  const row = await sql.get<EvidenceRow & { bytes: Uint8Array | null }>(
    "SELECT * FROM evidence WHERE id = ?",
    [id],
  );
  if (!row) return undefined;
  return {
    item: rowToEvidence(row),
    bytes: row.bytes ? new Uint8Array(row.bytes) : null,
  };
}

export async function deleteEvidence(sql: Sql, id: string): Promise<void> {
  await sql.run("DELETE FROM evidence WHERE id = ?", [id]);
}

// ---------- checks ----------

interface CheckRow {
  id: string;
  proofhold_id: string;
  predicate_id: string;
  round: number;
  source: CheckSource;
  verdict: Verdict;
  confidence: number | null;
  reasons_json: string;
  detail_json: string;
  created_at: string;
}

function rowToCheck(r: CheckRow): CheckResult {
  return {
    id: r.id,
    proofholdId: r.proofhold_id,
    predicateId: r.predicate_id,
    round: Number(r.round),
    source: r.source,
    verdict: r.verdict,
    confidence: r.confidence === null ? null : Number(r.confidence),
    reasons: JSON.parse(r.reasons_json),
    detail: JSON.parse(r.detail_json),
    createdAt: r.created_at,
  };
}

export async function recordCheck(
  sql: Sql,
  input: Omit<CheckResult, "id" | "createdAt">,
): Promise<CheckResult> {
  const id = newId("ck");
  await sql.run(
    `INSERT INTO checks (id, proofhold_id, predicate_id, round, source, verdict, confidence, reasons_json, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.proofholdId,
      input.predicateId,
      input.round,
      input.source,
      input.verdict,
      input.confidence,
      JSON.stringify(input.reasons),
      JSON.stringify(input.detail),
      nowIso(),
    ],
  );
  const row = await sql.get<CheckRow>("SELECT * FROM checks WHERE id = ?", [id]);
  return rowToCheck(row!);
}

export async function listChecks(
  sql: Sql,
  proofholdId: string,
  round?: number,
): Promise<CheckResult[]> {
  const rows =
    round === undefined
      ? await sql.all<CheckRow>(
          "SELECT * FROM checks WHERE proofhold_id = ? ORDER BY round, created_at",
          [proofholdId],
        )
      : await sql.all<CheckRow>(
          "SELECT * FROM checks WHERE proofhold_id = ? AND round = ? ORDER BY created_at",
          [proofholdId, round],
        );
  return rows.map(rowToCheck);
}

export async function latestRound(sql: Sql, proofholdId: string): Promise<number> {
  const row = await sql.get<{ r: number | null }>(
    "SELECT MAX(round) AS r FROM checks WHERE proofhold_id = ?",
    [proofholdId],
  );
  return Number(row?.r ?? 0);
}

// ---------- decisions ----------

interface DecisionRow {
  id: string;
  proofhold_id: string;
  outcome: Outcome;
  amount_cents: number;
  actor: Decision["actor"];
  rationale_json: string;
  paypal_capture_id: string | null;
  paypal_dispute_id: string | null;
  created_at: string;
}

function rowToDecision(r: DecisionRow): Decision {
  return {
    id: r.id,
    proofholdId: r.proofhold_id,
    outcome: r.outcome,
    amountCents: Number(r.amount_cents),
    actor: r.actor,
    rationale: JSON.parse(r.rationale_json),
    paypalCaptureId: r.paypal_capture_id,
    paypalDisputeId: r.paypal_dispute_id,
    createdAt: r.created_at,
  };
}

export async function recordDecision(
  sql: Sql,
  input: Omit<Decision, "id" | "createdAt">,
): Promise<Decision> {
  const id = newId("dc");
  await sql.run(
    `INSERT INTO decisions (id, proofhold_id, outcome, amount_cents, actor, rationale_json, paypal_capture_id, paypal_dispute_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.proofholdId,
      input.outcome,
      input.amountCents,
      input.actor,
      JSON.stringify(input.rationale),
      input.paypalCaptureId,
      input.paypalDisputeId,
      nowIso(),
    ],
  );
  const row = await sql.get<DecisionRow>("SELECT * FROM decisions WHERE id = ?", [id]);
  return rowToDecision(row!);
}

export async function listDecisions(sql: Sql, proofholdId: string): Promise<Decision[]> {
  const rows = await sql.all<DecisionRow>(
    "SELECT * FROM decisions WHERE proofhold_id = ? ORDER BY created_at",
    [proofholdId],
  );
  return rows.map(rowToDecision);
}

// ---------- messages ----------

export async function addMessage(
  sql: Sql,
  input: { proofholdId: string; author: Message["author"]; body: string },
): Promise<Message> {
  const id = newId("msg");
  const createdAt = nowIso();
  await sql.run(
    "INSERT INTO messages (id, proofhold_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, input.proofholdId, input.author, input.body, createdAt],
  );
  return {
    id,
    proofholdId: input.proofholdId,
    author: input.author,
    body: input.body,
    createdAt,
  };
}

export async function listMessages(sql: Sql, proofholdId: string): Promise<Message[]> {
  const rows = await sql.all<{
    id: string;
    proofhold_id: string;
    author: Message["author"];
    body: string;
    created_at: string;
  }>("SELECT * FROM messages WHERE proofhold_id = ? ORDER BY created_at", [proofholdId]);
  return rows.map((r) => ({
    id: r.id,
    proofholdId: r.proofhold_id,
    author: r.author,
    body: r.body,
    createdAt: r.created_at,
  }));
}

// ---------- audit chain ----------

interface AuditRow {
  id: string;
  proofhold_id: string;
  seq: number;
  type: string;
  data_json: string;
  prev_hash: string;
  hash: string;
  created_at: string;
}

function rowToAudit(r: AuditRow): AuditEntry {
  return {
    id: r.id,
    proofholdId: r.proofhold_id,
    seq: Number(r.seq),
    type: r.type,
    data: JSON.parse(r.data_json),
    prevHash: r.prev_hash,
    hash: r.hash,
    createdAt: r.created_at,
  };
}

export async function appendAudit(
  sql: Sql,
  proofholdId: string,
  type: string,
  data: Record<string, unknown>,
): Promise<AuditEntry> {
  const last = await sql.get<AuditRow>(
    "SELECT * FROM audit WHERE proofhold_id = ? ORDER BY seq DESC LIMIT 1",
    [proofholdId],
  );
  const entry = {
    proofholdId,
    seq: last ? Number(last.seq) + 1 : 1,
    type,
    data,
    prevHash: last ? last.hash : GENESIS,
    createdAt: nowIso(),
  };
  const hash = entryHash(entry);
  const id = newId("au");
  await sql.run(
    `INSERT INTO audit (id, proofhold_id, seq, type, data_json, prev_hash, hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      proofholdId,
      entry.seq,
      type,
      JSON.stringify(data),
      entry.prevHash,
      hash,
      entry.createdAt,
    ],
  );
  return { id, ...entry, hash };
}

export async function listAudit(sql: Sql, proofholdId: string): Promise<AuditEntry[]> {
  const rows = await sql.all<AuditRow>(
    "SELECT * FROM audit WHERE proofhold_id = ? ORDER BY seq",
    [proofholdId],
  );
  return rows.map(rowToAudit);
}

// ---------- paypal events ----------

export interface PayPalEventRecord {
  id: string;
  eventId: string;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  payload: Record<string, unknown>;
  verified: boolean;
  receivedAt: string;
  processedAt: string | null;
}

/** Stores an event; returns false when the event id was already seen. */
export async function recordPayPalEvent(
  sql: Sql,
  input: Omit<PayPalEventRecord, "id" | "receivedAt" | "processedAt">,
): Promise<boolean> {
  const existing = await sql.get("SELECT id FROM paypal_events WHERE event_id = ?", [
    input.eventId,
  ]);
  if (existing) return false;
  await sql.run(
    `INSERT INTO paypal_events (id, event_id, event_type, resource_type, resource_id, payload_json, verified, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId("pe"),
      input.eventId,
      input.eventType,
      input.resourceType,
      input.resourceId,
      JSON.stringify(input.payload),
      input.verified ? 1 : 0,
      nowIso(),
    ],
  );
  return true;
}

export async function markPayPalEventProcessed(sql: Sql, eventId: string): Promise<void> {
  await sql.run("UPDATE paypal_events SET processed_at = ? WHERE event_id = ?", [
    nowIso(),
    eventId,
  ]);
}

export async function listPayPalEvents(
  sql: Sql,
  resourceIds: string[],
): Promise<PayPalEventRecord[]> {
  if (resourceIds.length === 0) return [];
  const rows = await sql.all<{
    id: string;
    event_id: string;
    event_type: string;
    resource_type: string | null;
    resource_id: string | null;
    payload_json: string;
    verified: number;
    received_at: string;
    processed_at: string | null;
  }>(
    `SELECT * FROM paypal_events WHERE resource_id IN (${resourceIds.map(() => "?").join(",")}) ORDER BY received_at`,
    resourceIds,
  );
  return rows.map((r) => ({
    id: r.id,
    eventId: r.event_id,
    eventType: r.event_type,
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    payload: JSON.parse(r.payload_json),
    verified: Boolean(r.verified),
    receivedAt: r.received_at,
    processedAt: r.processed_at,
  }));
}

// ---------- simulated paypal objects ----------

export async function simGet<T>(
  sql: Sql,
  kind: string,
  id: string,
): Promise<T | undefined> {
  const row = await sql.get<{ body_json: string }>(
    "SELECT body_json FROM simulated_paypal WHERE kind = ? AND id = ?",
    [kind, id],
  );
  return row ? (JSON.parse(row.body_json) as T) : undefined;
}

export async function simPut(
  sql: Sql,
  kind: string,
  id: string,
  body: unknown,
): Promise<void> {
  const existing = await sql.get(
    "SELECT id FROM simulated_paypal WHERE kind = ? AND id = ?",
    [kind, id],
  );
  if (existing) {
    await sql.run(
      "UPDATE simulated_paypal SET body_json = ?, updated_at = ? WHERE kind = ? AND id = ?",
      [JSON.stringify(body), nowIso(), kind, id],
    );
  } else {
    await sql.run(
      "INSERT INTO simulated_paypal (id, kind, body_json, updated_at) VALUES (?, ?, ?, ?)",
      [id, kind, JSON.stringify(body), nowIso()],
    );
  }
}

export async function simList<T>(sql: Sql, kind: string): Promise<T[]> {
  const rows = await sql.all<{ body_json: string }>(
    "SELECT body_json FROM simulated_paypal WHERE kind = ? ORDER BY updated_at",
    [kind],
  );
  return rows.map((r) => JSON.parse(r.body_json) as T);
}
