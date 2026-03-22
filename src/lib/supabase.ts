import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

// Client côté browser / Server Components sans auth (utilise la clé anon + RLS)
// RLS basé sur le JWT Clerk passé via createAuthenticatedClient()
export function getSupabaseClient() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient<Database>(getSupabaseUrl(), anonKey);
}

// Client authentifié — passe le JWT Clerk dans le header Authorization.
// Permet à Supabase d'appliquer les RLS avec auth.jwt() ->> 'sub' = clerk_id.
//
// PREREQUISITE : configurer Supabase pour accepter les JWTs Clerk.
// Supabase Dashboard → Project Settings → Auth → Third-party auth providers
// → Add Clerk (JWKS URL: https://<clerk-domain>/.well-known/jwks.json)
export function createAuthenticatedClient(clerkToken: string) {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient<Database>(getSupabaseUrl(), anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${clerkToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Client service role côté serveur — bypass RLS.
// UNIQUEMENT dans les Server Actions et API routes (webhook Clerk, billing, débit crédits).
// JAMAIS exposé côté browser.
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(getSupabaseUrl(), serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
