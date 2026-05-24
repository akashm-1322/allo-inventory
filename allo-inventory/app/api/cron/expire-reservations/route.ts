import { NextRequest, NextResponse } from "next/server";
import { expireStaleReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Protect the endpoint from unauthorized calls in production
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await expireStaleReservations();

  return NextResponse.json({
    ok: true,
    expired: count,
    timestamp: new Date().toISOString(),
  });
}
