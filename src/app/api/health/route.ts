import { db } from "@/lib/store/sql";
import { systemInfo } from "@/lib/view";

export async function GET() {
  try {
    await (await db()).get("SELECT 1 AS ok");
    return Response.json({ ok: true, ...systemInfo() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
