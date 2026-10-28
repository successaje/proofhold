/**
 * Schema migrations, applied in order at startup and recorded in `migrations`.
 * `BLOB_TYPE` is substituted per dialect (BLOB for SQLite, BYTEA for Postgres).
 */
export const migrations: { name: string; sql: string }[] = [
  {
    name: "001_init",
    sql: `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proofholds (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  buyer_token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  brief TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  buyer_email TEXT,
  buyer_name TEXT,
  status TEXT NOT NULL,
  test_json TEXT NOT NULL,
  test_hash TEXT NOT NULL,
  seller_agreed_at TEXT,
  buyer_agreed_at TEXT,
  paypal_order_id TEXT,
  paypal_authorization_id TEXT,
  authorization_expires_at TEXT,
  honor_period_ends_at TEXT,
  silence_window_ends_at TEXT,
  evidence_submitted_at TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS proofholds_workspace ON proofholds(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS proofholds_status ON proofholds(status);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  proofhold_id TEXT NOT NULL REFERENCES proofholds(id),
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL,
  sha256 TEXT,
  bytes BLOB_TYPE,
  metadata_json TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS evidence_proofhold ON evidence(proofhold_id, created_at);

CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  proofhold_id TEXT NOT NULL REFERENCES proofholds(id),
  predicate_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  source TEXT NOT NULL,
  verdict TEXT NOT NULL,
  confidence REAL,
  reasons_json TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS checks_proofhold ON checks(proofhold_id, round);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  proofhold_id TEXT NOT NULL REFERENCES proofholds(id),
  outcome TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  actor TEXT NOT NULL,
  rationale_json TEXT NOT NULL,
  paypal_capture_id TEXT,
  paypal_dispute_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS decisions_proofhold ON decisions(proofhold_id, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  proofhold_id TEXT NOT NULL REFERENCES proofholds(id),
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_proofhold ON messages(proofhold_id, created_at);

CREATE TABLE IF NOT EXISTS paypal_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  payload_json TEXT NOT NULL,
  verified INTEGER NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS paypal_events_resource ON paypal_events(resource_id);

CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  proofhold_id TEXT NOT NULL REFERENCES proofholds(id),
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  data_json TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (proofhold_id, seq)
);

CREATE TABLE IF NOT EXISTS simulated_paypal (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  body_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`,
  },
];
