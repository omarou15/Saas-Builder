// FYREN — Deploy utilities
// Shared helpers used across the deploy pipeline modules.

/** Patterns that look like secrets — strip them from log strings */
const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9]{36,}/g,          // GitHub personal access tokens
  /gho_[A-Za-z0-9]{36,}/g,          // GitHub OAuth tokens
  /ghs_[A-Za-z0-9]{36,}/g,          // GitHub server-to-server tokens
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, // JWTs (Supabase service role keys)
  /sk_live_[A-Za-z0-9]{24,}/g,      // Stripe live secret keys
  /sk_test_[A-Za-z0-9]{24,}/g,      // Stripe test secret keys
  /Bearer\s+[A-Za-z0-9._~+\-/]+=*/g, // Authorization headers
];

/**
 * Strip secrets from a string before it reaches any log sink.
 * CLAUDE.md rule: "Les API keys ne sont JAMAIS loguées — sanitization dans tous les logs"
 */
export function sanitizeForLog(input: string): string {
  let sanitized = input;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized;
}

/** Sleep helper for retry backoff */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Safely extract a string error message without leaking secrets */
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return sanitizeForLog(raw);
}
