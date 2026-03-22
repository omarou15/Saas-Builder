import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Slugify a project name for use as a URL-safe identifier */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Strip sensitive data from log output (API keys, tokens) */
export function sanitizeForLog(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) return obj;

  const sensitiveKeys = new Set([
    "api_key",
    "apiKey",
    "token",
    "access_token",
    "secret",
    "password",
    "key",
    "config",
  ]);

  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      sensitiveKeys.has(k) ? "[REDACTED]" : sanitizeForLog(v),
    ])
  );
}
