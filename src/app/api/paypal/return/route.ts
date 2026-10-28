import { config } from "@/lib/config";
import { db } from "@/lib/store/sql";
import { completeApproval } from "@/lib/proofholds/approval";
import { getProofholdByOrder } from "@/lib/store/repos";

/** PayPal sends the buyer here after approval with `token=<orderId>`. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  const base = config().APP_URL;
  if (!orderId) return Response.redirect(`${base}/?error=missing-order`, 303);
  const sql = await db();
  try {
    const ph = await completeApproval(sql, orderId);
    return Response.redirect(`${base}/p/${ph.buyerToken}?approved=1`, 303);
  } catch (error) {
    console.error("[paypal/return]", error);
    const ph = await getProofholdByOrder(sql, orderId);
    const message = encodeURIComponent(
      error instanceof Error ? error.message : "Approval failed",
    );
    return Response.redirect(
      ph ? `${base}/p/${ph.buyerToken}?error=${message}` : `${base}/?error=${message}`,
      303,
    );
  }
}
