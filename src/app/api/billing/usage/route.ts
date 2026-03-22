// GET /api/billing/usage
// Retourne l'historique des transactions crédits de l'utilisateur.
// Supporte la pagination via ?limit=&offset=

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: Request): Promise<NextResponse> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit : 30 req/min
  const rl = rateLimit(`${clerkId}:billing:usage`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans une minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Pagination
  const url = new URL(req.url);
  const limitParam = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const offsetParam = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, MAX_LIMIT);
  const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;

  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ transactions: [], total: 0, limit, offset });
  }

  const supabase = createServiceClient();
  const { data: transactions, error, count } = await supabase
    .from("credit_transactions")
    .select("id, type, amount, description, stripe_id, project_id, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[GET /api/billing/usage]", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({
    transactions: transactions ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
