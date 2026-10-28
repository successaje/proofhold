import { config } from "@/lib/config";
import { db } from "@/lib/store/sql";
import { cancelApproval } from "@/lib/proofholds/approval";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("token");
  const base = config().APP_URL;
  if (!orderId) return Response.redirect(`${base}/`, 303);
  const ph = await cancelApproval(await db(), orderId).catch(() => undefined);
  return Response.redirect(
    ph ? `${base}/p/${ph.buyerToken}?cancelled=1` : `${base}/`,
    303,
  );
}
