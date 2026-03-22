// Rate limiter in-memory (par process Next.js).
// Adapté pour les API routes serverless : fonctionne en dev et en prod
// sur un seul instance. Pour multi-instance prod → remplacer par Upstash Redis.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Map globale : survit aux hot-reloads en dev via module cache
const store = new Map<string, RateLimitEntry>();

// Nettoyage périodique des entrées expirées (évite les fuites mémoire)
// Déclenché à chaque appel, supprime les entrées expirées depuis > 5 min
function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now - 5 * 60 * 1000) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // timestamp ms
}

/**
 * Vérifie et incrémente le compteur de rate limit.
 * @param key      Identifiant unique (e.g. `${userId}:chat`)
 * @param limit    Nombre max de requêtes dans la fenêtre
 * @param windowMs Taille de la fenêtre en ms (e.g. 60_000 = 1 min)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  pruneExpired();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // Nouvelle fenêtre
    const newEntry: RateLimitEntry = { count: 1, resetAt: now + windowMs };
    store.set(key, newEntry);
    return { allowed: true, remaining: limit - 1, resetAt: newEntry.resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
