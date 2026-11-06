import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Record } from "@/components/proofhold/record";
import { db } from "@/lib/store/sql";
import {
  getProofholdByToken,
  getWorkspace,
  listAudit,
  listChecks,
  listDecisions,
  listEvidence,
  listMessages,
} from "@/lib/store/repos";
import { proofholdView, systemInfo } from "@/lib/view";

export const metadata: Metadata = { title: "Record", robots: { index: false } };

export default async function BuyerRecordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sql = await db();
  const raw = await getProofholdByToken(sql, token);
  if (!raw || raw.status === "draft" || raw.status === "proposed") notFound();
  const [evidence, checks, decisions, messages, audit, seller] = await Promise.all([
    listEvidence(sql, raw.id),
    listChecks(sql, raw.id),
    listDecisions(sql, raw.id),
    listMessages(sql, raw.id),
    listAudit(sql, raw.id),
    getWorkspace(sql, raw.workspaceId),
  ]);
  return (
    <Record
      ph={proofholdView(raw)}
      sellerName={seller?.name ?? "The seller"}
      audience="buyer"
      checks={checks}
      decisions={decisions}
      evidence={evidence}
      messages={messages}
      audit={audit}
      system={systemInfo()}
      backHref={`/p/${token}`}
    />
  );
}
