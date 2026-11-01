import { handle, HttpError } from "@/lib/http";
import { currentWorkspace } from "@/lib/session/workspace";
import { db } from "@/lib/store/sql";
import { listProofholds } from "@/lib/store/repos";
import { filterLedger, ledgerCsv, parseLedgerQuery } from "@/lib/domain/ledger";

/** The ledger as CSV, honouring the same search, bucket and sort as the list page. */
export const GET = handle(async (request: Request) => {
  const ws = await currentWorkspace();
  if (!ws) throw new HttpError("Sign in first.", 401);
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const items = filterLedger(
    await listProofholds(await db(), ws.id),
    parseLedgerQuery(params),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(ledgerCsv(items), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="proofhold-ledger-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
