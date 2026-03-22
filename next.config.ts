import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WebContainers require cross-origin isolation to use SharedArrayBuffer (WASM threads).
  // These headers MUST be set on any page that calls WebContainer.boot().
  async headers() {
    return [
      {
        // Apply to workspace pages that host the WebContainer preview.
        // Clerk UserButton uses cross-origin iframes — Clerk supports COEP via
        // credentialless or corp-aware configs. Restrict to /app/* to avoid
        // breaking auth pages.
        source: "/app/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
