// WebContainer Manager — module-level singleton, BROWSER ONLY
// Wraps @webcontainer/api with:
//   • boot() — boots once, mounts React/Vite/Tailwind template
//   • writeFile(agentPath, content) — injects files from E2B agent (strips /workspace/ prefix)
//   • deleteFile(agentPath) — removes file from WC filesystem
//   • listFiles(dir) — recursive listing (excludes node_modules)
//   • Status events via onStatus() / onServerReady()
//
// IMPORTANT (piège CLAUDE.md) : WebContainer.boot() est async.
// mount() NE peut PAS être appelé avant que boot() soit résolu.

import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import { CONSOLE_CAPTURE_SCRIPT, parseBuildError } from "./console-capture";
import type { BuildError } from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type WCStatus =
  | "idle"
  | "booting"
  | "installing"
  | "starting"
  | "running"
  | "error";

type StatusListener = (status: WCStatus, error?: string) => void;
type ServerReadyListener = (url: string) => void;
type StderrListener = (data: string) => void;
type BuildErrorListener = (errors: BuildError[]) => void;

// ─────────────────────────────────────────────
// Starter template — React + Vite + Tailwind
// ─────────────────────────────────────────────
// Minimal but functional — the agent will overwrite most of these files.
// Uses Tailwind 3 (not 4) because Vite + Tailwind 4 requires a different setup
// that may not be compatible with shadcn/ui in a WebContainer environment.

const STARTER_TEMPLATE: FileSystemTree = {
  "package.json": {
    file: {
      contents: JSON.stringify(
        {
          name: "fyren-preview",
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: {
            dev: "vite --host",
            build: "tsc && vite build",
          },
          dependencies: {
            react: "^18.3.1",
            "react-dom": "^18.3.1",
          },
          devDependencies: {
            "@types/react": "^18.3.12",
            "@types/react-dom": "^18.3.1",
            "@vitejs/plugin-react": "^4.3.3",
            typescript: "^5.6.3",
            vite: "^6.0.3",
            tailwindcss: "^3.4.16",
            autoprefixer: "^10.4.20",
            postcss: "^8.4.49",
          },
        },
        null,
        2
      ),
    },
  },
  "index.html": {
    file: {
      contents: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FYREN Preview</title>
    ${CONSOLE_CAPTURE_SCRIPT}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
  },
  "vite.config.ts": {
    file: {
      contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { hmr: true },
})`,
    },
  },
  "tsconfig.json": {
    file: {
      contents: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            isolatedModules: true,
            moduleDetection: "force",
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
          },
          include: ["src"],
        },
        null,
        2
      ),
    },
  },
  "postcss.config.js": {
    file: {
      contents: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
    },
  },
  "tailwind.config.js": {
    file: {
      contents: `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}`,
    },
  },
  src: {
    directory: {
      "main.tsx": {
        file: {
          contents: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
        },
      },
      "App.tsx": {
        file: {
          contents: `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center mx-auto">
          <span className="text-white font-bold text-lg">F</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">FYREN Preview</h1>
        <p className="text-sm text-gray-500">L'agent code votre application ici...</p>
      </div>
    </div>
  )
}`,
        },
      },
      "index.css": {
        file: {
          contents: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
        },
      },
    },
  },
};

// ─────────────────────────────────────────────
// WebContainerManager — singleton class
// ─────────────────────────────────────────────

class WebContainerManager {
  private wc: WebContainer | null = null;
  private bootPromise: Promise<WebContainer> | null = null;

  private statusListeners: Set<StatusListener> = new Set();
  private serverReadyListeners: Set<ServerReadyListener> = new Set();
  private stderrListeners: Set<StderrListener> = new Set();
  private buildErrorListeners: Set<BuildErrorListener> = new Set();

  private _status: WCStatus = "idle";
  private _serverUrl: string | null = null;
  private _error: string | undefined = undefined;

  get status(): WCStatus {
    return this._status;
  }
  get serverUrl(): string | null {
    return this._serverUrl;
  }
  get error(): string | undefined {
    return this._error;
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    // Immediately notify with current status
    fn(this._status, this._error);
    return () => this.statusListeners.delete(fn);
  }

  onServerReady(fn: ServerReadyListener): () => void {
    this.serverReadyListeners.add(fn);
    // If server already running, notify immediately
    if (this._serverUrl) fn(this._serverUrl);
    return () => this.serverReadyListeners.delete(fn);
  }

  onStderr(fn: StderrListener): () => void {
    this.stderrListeners.add(fn);
    return () => this.stderrListeners.delete(fn);
  }

  onBuildError(fn: BuildErrorListener): () => void {
    this.buildErrorListeners.add(fn);
    return () => this.buildErrorListeners.delete(fn);
  }

  private emit(status: WCStatus, error?: string) {
    this._status = status;
    this._error = error;
    for (const fn of this.statusListeners) fn(status, error);
  }

  // ── Public API ───────────────────────────────

  async boot(): Promise<void> {
    // Guard: browser only
    if (typeof window === "undefined") {
      throw new Error("WebContainerManager.boot() must be called in the browser");
    }

    // Already booted and running — nothing to do
    if (this.wc) {
      // If server is already ready, re-notify listeners (component remount)
      if (this._serverUrl) {
        this.emit("running");
        for (const fn of this.serverReadyListeners) fn(this._serverUrl);
      }
      return;
    }

    // Already booting — wait for the in-flight promise
    if (this.bootPromise) {
      await this.bootPromise;
      return;
    }

    this.emit("booting");

    try {
      // CRITIQUE : boot() doit résoudre AVANT tout appel fs ou mount (CLAUDE.md)
      // WebContainer.boot() ne peut être appelé qu'UNE SEULE FOIS par page.
      this.bootPromise = WebContainer.boot();
      this.wc = await this.bootPromise;

      // Register server-ready BEFORE mounting/running anything
      this.wc.on("server-ready", (_port, url) => {
        this._serverUrl = url;
        this.emit("running");
        for (const fn of this.serverReadyListeners) fn(url);
      });

      // Mount the starter template — requires boot() to be resolved first
      await this.wc.mount(STARTER_TEMPLATE);

      // npm install
      await this.install();

      // Start the dev server (fire-and-forget — keeps running)
      this.startDevServer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "WebContainer boot failed";

      // "Unable to create more instances" = WebContainer already booted in this page.
      // Reset bootPromise so the "Réessayer" button can call resetAndBoot().
      if (msg.includes("Unable to create more instances")) {
        this.bootPromise = null;
        this.wc = null;
        this.emit("error", msg);
        return;
      }

      this.emit("error", msg);
      // Reset so callers can retry on transient failures
      this.bootPromise = null;
      this.wc = null;
      throw err;
    }
  }

  /**
   * Teardown the WebContainer instance. Call on page unmount.
   */
  teardown(): void {
    if (this.wc) {
      this.wc.teardown();
    }
    this.wc = null;
    this.bootPromise = null;
    this._status = "idle";
    this._serverUrl = null;
    this._error = undefined;
    this.emit("idle");
  }

  /**
   * Full recovery: teardown whatever exists, then boot fresh.
   * Used by the "Réessayer" button after an error.
   */
  async resetAndBoot(): Promise<void> {
    this.teardown();
    await this.boot();
  }

  /**
   * Re-mount the starter template without tearing down the WebContainer.
   * Used when navigating between projects.
   */
  async remountTemplate(): Promise<void> {
    if (!this.wc) return;
    await this.wc.mount(STARTER_TEMPLATE);
  }

  async writeFile(agentPath: string, content: string): Promise<void> {
    if (!this.wc) return;

    // Strip /workspace/ prefix — E2B paths use /workspace/, WC uses relative paths
    const path = agentPath.replace(/^\/workspace\//, "");

    // Ensure parent directory exists before writing
    const segments = path.split("/");
    if (segments.length > 1) {
      const parentDir = segments.slice(0, -1).join("/");
      try {
        await this.wc.fs.mkdir(parentDir, { recursive: true });
      } catch {
        // Directory may already exist — ignore EEXIST errors
      }
    }

    await this.wc.fs.writeFile(path, content, "utf-8");
  }

  async deleteFile(agentPath: string): Promise<void> {
    if (!this.wc) return;
    const path = agentPath.replace(/^\/workspace\//, "");
    try {
      await this.wc.fs.rm(path);
    } catch {
      // File may not exist — ignore
    }
  }

  // Recursive file listing (excludes node_modules, .git)
  async listFiles(dir = "."): Promise<string[]> {
    if (!this.wc) return [];

    try {
      const entries = await this.wc.fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;

        const fullPath = dir === "." ? entry.name : `${dir}/${entry.name}`;

        if (entry.isDirectory()) {
          const nested = await this.listFiles(fullPath);
          files.push(...nested);
        } else {
          files.push(fullPath);
        }
      }

      return files.sort();
    } catch {
      return [];
    }
  }

  // ── Private helpers ──────────────────────────

  private async install(): Promise<void> {
    if (!this.wc) throw new Error("WebContainer not booted");
    this.emit("installing");

    const proc = await this.wc.spawn("npm", ["install"]);
    const exitCode = await proc.exit;

    if (exitCode !== 0) {
      throw new Error(`npm install failed (exit code ${exitCode})`);
    }
  }

  private startDevServer(): void {
    if (!this.wc) return;
    this.emit("starting");

    // Fire-and-forget — server keeps running until WC is torn down.
    // server-ready event (registered in boot()) will set status → "running".
    void this.wc.spawn("npm", ["run", "dev"]).then((proc) => {
      // Capture stderr for build error detection
      // WebContainer process output is a ReadableStream<string>
      void proc.output.pipeTo(
        new WritableStream<string>({
          write: (text: string) => {
            // Notify raw stderr listeners
            for (const fn of this.stderrListeners) fn(text);

            // Parse and emit build errors
            const errors = parseBuildError(text);
            if (errors.length > 0) {
              for (const fn of this.buildErrorListeners) fn(errors);
            }
          },
        })
      );
    });
  }
}

// Module-level singleton — one WebContainer per browser tab
// (WebContainer.boot() itself enforces a single instance per origin)
export const webContainerManager = new WebContainerManager();
