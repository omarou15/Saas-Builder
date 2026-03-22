// FYREN — E2B Sandbox Manager
// Lifecycle: create → configure workspace → (agent runs) → destroy
// Each client build session gets its own isolated Firecracker microVM.
//
// CLAUDE.md pitfall: implement heartbeat for long-running sessions (idle timeout)

import { Sandbox } from "e2b";

// Base Next.js 15 + shadcn/ui template scaffold injected into every new sandbox.
// The agent will build on top of this via the Build tools.
const WORKSPACE_SCAFFOLD = `{
  "name": "fyren-workspace",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.5.14",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "@clerk/nextjs": "^6.22.0",
    "@supabase/supabase-js": "^2.49.4",
    "tailwindcss": "^4",
    "lucide-react": "^0.511.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}`;

const NEXT_CONFIG = `import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`;

const TAILWIND_CONFIG = `import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
`;

const GLOBALS_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;

const LAYOUT_TSX = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "App",
  description: "Built with FYREN",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

const PAGE_TSX = `export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Ready to build 🚀</h1>
    </main>
  );
}
`;

// ============================================================
// SandboxManager
// ============================================================

export interface SandboxInfo {
  sandboxId: string;
  sandbox: Sandbox;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Create a new E2B sandbox pre-configured with a Next.js workspace.
 * Returns both the Sandbox instance (for in-process reuse) and its ID (for reconnect).
 */
export async function createSandbox(): Promise<SandboxInfo> {
  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    // 30-minute initial timeout — heartbeat extends this
    timeoutMs: 30 * 60 * 1000,
  });

  // Bootstrap /workspace/ with the Next.js scaffold
  await initWorkspace(sandbox);

  return { sandboxId: sandbox.sandboxId, sandbox };
}

/**
 * Reconnect to an existing sandbox by ID.
 * Used when the FYREN backend restarts or a different worker picks up a session.
 */
export async function connectSandbox(sandboxId: string): Promise<Sandbox> {
  return await Sandbox.connect(sandboxId, {
    apiKey: process.env.E2B_API_KEY,
  });
}

/**
 * Destroy a sandbox permanently.
 */
export async function destroySandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.kill();
  } catch {
    // Sandbox may have already timed out — ignore
  }
}

/**
 * Extend sandbox lifetime by timeoutMs milliseconds.
 * Call this on a regular interval (heartbeat) to prevent idle timeout.
 * CLAUDE.md: "E2B: implémenter un heartbeat pour les sessions longues (idle timeout)"
 */
export async function keepSandboxAlive(sandbox: Sandbox, timeoutMs = 10 * 60 * 1000): Promise<void> {
  try {
    await sandbox.setTimeout(timeoutMs);
  } catch {
    // Non-fatal — next heartbeat will retry
  }
}

// ============================================================
// Filesystem operations (proxied to E2B sandbox)
// ============================================================

export async function sandboxReadFile(sandbox: Sandbox, path: string): Promise<string> {
  const content = await sandbox.files.read(absolutePath(path));
  return content;
}

export async function sandboxWriteFile(
  sandbox: Sandbox,
  path: string,
  content: string
): Promise<void> {
  await sandbox.files.write(absolutePath(path), content);
}

export async function sandboxDeleteFile(sandbox: Sandbox, path: string): Promise<void> {
  // E2B doesn't have a direct delete — use bash
  await sandbox.commands.run(`rm -f "${absolutePath(path)}"`);
}

export async function sandboxListFiles(
  sandbox: Sandbox,
  dirPath: string
): Promise<string[]> {
  const result = await sandbox.commands.run(
    `find "${absolutePath(dirPath)}" -type f 2>/dev/null | sort`
  );
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((p) => p.replace("/workspace/", ""));
}

// ============================================================
// Command execution
// ============================================================

export async function sandboxRun(
  sandbox: Sandbox,
  command: string,
  cwd = "/workspace",
  onStdout?: (chunk: string) => void,
  onStderr?: (chunk: string) => void
): Promise<CommandResult> {
  const result = await sandbox.commands.run(command, {
    cwd,
    timeoutMs: 60_000, // 1-minute timeout per command
    onStdout: (chunk) => {
      onStdout?.(chunk);
    },
    onStderr: (chunk) => {
      onStderr?.(chunk);
    },
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr ?? "",
    exitCode: result.exitCode,
  };
}

// ============================================================
// Internal helpers
// ============================================================

/** Ensure all paths are absolute and rooted at /workspace */
function absolutePath(path: string): string {
  const cleaned = path.replace(/^\/workspace\/?/, "").replace(/^\.\//, "");
  return `/workspace/${cleaned}`;
}

/** Bootstrap the /workspace/ directory with the Next.js scaffold */
async function initWorkspace(sandbox: Sandbox): Promise<void> {
  const files: [string, string][] = [
    ["/workspace/package.json", WORKSPACE_SCAFFOLD],
    ["/workspace/next.config.ts", NEXT_CONFIG],
    ["/workspace/tsconfig.json", TSCONFIG],
    ["/workspace/tailwind.config.ts", TAILWIND_CONFIG],
    ["/workspace/src/app/globals.css", GLOBALS_CSS],
    ["/workspace/src/app/layout.tsx", LAYOUT_TSX],
    ["/workspace/src/app/page.tsx", PAGE_TSX],
    ["/workspace/.env.local", "# Environment variables (injected by FYREN at deploy)\n"],
  ];

  for (const [path, content] of files) {
    await sandbox.files.write(path, content);
  }
}
