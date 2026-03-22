// GET /api/cron/sandbox-heartbeat — Keep E2B sandboxes alive
// Called every 4 minutes by Vercel Cron
// vercel.json: { "crons": [{ "path": "/api/cron/sandbox-heartbeat", "schedule": "*/4 * * * *" }] }

import { NextResponse } from "next/server";
import { Sandbox } from "e2b";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  // Verify Vercel Cron auth header
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find active sessions (not closed, created in the last 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: sessions } = await supabase
    .from("agent_sessions")
    .select("session_id, sandbox_id")
    .neq("status", "closed")
    .gte("created_at", twoHoursAgo);

  let pinged = 0;
  let failed = 0;

  for (const row of sessions ?? []) {
    try {
      const sandbox = await Sandbox.connect(row.sandbox_id as string);
      await sandbox.setTimeout(10 * 60 * 1000); // extend 10 min
      pinged++;
    } catch {
      // Sandbox already dead — mark session as closed
      await supabase
        .from("agent_sessions")
        .update({ status: "closed" })
        .eq("session_id", row.session_id);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    pinged,
    failed,
    total: sessions?.length ?? 0,
  });
}
