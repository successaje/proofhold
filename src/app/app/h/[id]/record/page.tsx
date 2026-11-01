import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Record } from "@/components/proofhold/record";
import { currentWorkspace } from "@/lib/session/workspace";
import { db } from "@/lib/store/sql";
import {
  getProofhold,
  listAudit,
  listChecks,
  listDecisions,
  listEvidence,
  listMessages,
} from "@/lib/store/repos";
import { sellerView, systemInfo } from "@/lib/view";

export const metadata: Metadata = { title: "Record" };

export default async function SellerRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = (await currentWorkspace())!;
  const sql = await db();
  const raw = await getProofhold(sql, id);
  if (!raw || raw.workspaceId !== ws.id) notFound();
  const [evidence, checks, decisions, messages, audit] = await Promise.all([
    listEvidence(sql, raw.id),
    listChecks(sql, raw.id),
    listDecisions(sql, raw.id),
    listMessages(sql, raw.id),
    listAudit(sql, raw.id),
  ]);
  return (
    <Record
      ph={sellerView(raw)}
      sellerName={ws.name}
      audience="seller"
      checks={checks}
      decisions={decisions}
      evidence={evidence}
      messages={messages}
      audit={audit}
      system={systemInfo()}
      backHref={`/app/h/${raw.id}`}
    />
  );
}
