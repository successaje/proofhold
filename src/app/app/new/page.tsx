import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { currentWorkspace } from "@/lib/session/workspace";
import { db } from "@/lib/store/sql";
import { getProofhold } from "@/lib/store/repos";
import { formatDate } from "@/lib/format";
import { systemInfo } from "@/lib/view";
import { Composer, type ComposerInitial } from "./composer";

export const metadata: Metadata = { title: "New proofhold" };

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

/** Build the composer's starting state from a past proofhold in this workspace. */
async function initialFrom(id: string): Promise<ComposerInitial | null> {
  const ws = (await currentWorkspace())!;
  const ph = await getProofhold(await db(), id);
  if (!ph || ph.workspaceId !== ws.id) return null;
  const currency = currencies.find((c) => c === ph.currency) ?? "USD";
  const hasDeadline = ph.test.predicates.some((p) => p.check.kind === "deadline");
  const unclear = [
    `Reused from “${ph.title}” (${formatDate(ph.createdAt, { time: false })}).${
      hasDeadline ? " Check the deadline lines before you send." : ""
    }`,
    ...ph.test.unclear,
  ].slice(0, 8);
  return {
    from: { id: ph.id, title: ph.title },
    draft: {
      title: ph.title,
      kind: ph.kind,
      brief: ph.brief,
      amount: (ph.amountCents / 100).toFixed(2).replace(/\.00$/, ""),
      currency,
      deadline: "",
      buyerEmail: ph.buyerEmail ?? "",
    },
    test: { ...ph.test, unclear },
  };
}

export default async function NewProofholdPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; kind?: string; amount?: string }>;
}) {
  const { from, kind, amount } = await searchParams;
  const initial = from ? await initialFrom(from) : null;
  const prefill: { kind?: "service" | "goods"; amount?: string } = {
    ...(kind === "goods" || kind === "service" ? { kind } : {}),
    ...(amount && /^\d{1,7}(\.\d{1,2})?$/.test(amount) ? { amount } : {}),
  };
  return (
    <>
      <PageHeader
        title="New proofhold"
        lead={
          initial
            ? `Starting from “${initial.from.title}”. Edit what changed; the buyer link will be new.`
            : "Describe the job. Get a test. Send one link."
        }
      />
      <Composer system={systemInfo()} initial={initial} prefill={prefill} />
    </>
  );
}
