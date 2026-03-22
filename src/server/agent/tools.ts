// FYREN — Agent tools
// Each tool maps to a Claude Code SDK equivalent (Read, Write, Edit, Bash, Glob, Grep)
// but executes on the E2B sandbox filesystem — not the local FYREN server.
//
// Built with Vercel AI SDK v6 tool() helper.
// In ai v6: schema is `inputSchema: zodSchema(z.object(...))` (not `parameters`)

import { tool, zodSchema } from "ai";
import { z } from "zod";
import type { Sandbox } from "e2b";
import {
  sandboxReadFile,
  sandboxWriteFile,
  sandboxDeleteFile,
  sandboxListFiles,
  sandboxRun,
} from "./sandbox-manager";
import type { FileChangePayload } from "@/types";

export type FileChangeCallback = (payload: FileChangePayload) => void;

// ============================================================
// Tool factory — takes the live Sandbox instance + file change callback
// ============================================================

export function createAgentTools(sandbox: Sandbox, onFileChange: FileChangeCallback) {
  return {
    // ----------------------------------------------------------
    // Read — read file contents from /workspace/
    // ----------------------------------------------------------
    Read: tool({
      description:
        "Read the complete contents of a file in the workspace. Always read before editing.",
      inputSchema: zodSchema(
        z.object({
          path: z
            .string()
            .describe(
              "File path relative to /workspace/ (e.g. 'src/app/page.tsx' or 'package.json')"
            ),
        })
      ),
      execute: async ({ path }: { path: string }) => {
        try {
          return await sandboxReadFile(sandbox, path);
        } catch {
          return `Error: file not found at ${path}`;
        }
      },
    }),

    // ----------------------------------------------------------
    // Write — create or overwrite a file in /workspace/
    // ----------------------------------------------------------
    Write: tool({
      description:
        "Create a new file or overwrite an existing file with complete content. Use Edit for partial changes.",
      inputSchema: zodSchema(
        z.object({
          path: z.string().describe("File path relative to /workspace/"),
          content: z.string().describe("Complete file content to write"),
        })
      ),
      execute: async ({ path, content }: { path: string; content: string }) => {
        await sandboxWriteFile(sandbox, path, content);
        onFileChange({ path, content, operation: "create" });
        return `Written: ${path} (${content.length} chars)`;
      },
    }),

    // ----------------------------------------------------------
    // Edit — targeted string replacement in a file
    // ----------------------------------------------------------
    Edit: tool({
      description:
        "Make a targeted replacement in an existing file. Replaces the FIRST occurrence of old_str with new_str. Read the file first to ensure old_str is unique.",
      inputSchema: zodSchema(
        z.object({
          path: z.string().describe("File path relative to /workspace/"),
          old_str: z
            .string()
            .describe(
              "The exact string to replace (must be unique — include surrounding context if needed)"
            ),
          new_str: z.string().describe("The replacement string"),
        })
      ),
      execute: async ({
        path,
        old_str,
        new_str,
      }: {
        path: string;
        old_str: string;
        new_str: string;
      }) => {
        let content: string;
        try {
          content = await sandboxReadFile(sandbox, path);
        } catch {
          return `Error: file not found at ${path}`;
        }

        if (!content.includes(old_str)) {
          return `Error: old_str not found in ${path}. Read the file first to check the exact content.`;
        }

        const updated = content.replace(old_str, new_str);
        await sandboxWriteFile(sandbox, path, updated);
        onFileChange({ path, content: updated, operation: "update" });
        return `Edited: ${path}`;
      },
    }),

    // ----------------------------------------------------------
    // Bash — run a shell command in /workspace/
    // ----------------------------------------------------------
    Bash: tool({
      description:
        "Run a shell command in the /workspace/ directory. Use for npm install, running scripts, creating directories, etc. Output is truncated at 8000 chars.",
      inputSchema: zodSchema(
        z.object({
          command: z
            .string()
            .describe("Shell command to run (working directory: /workspace/)"),
        })
      ),
      execute: async ({ command }: { command: string }) => {
        const result = await sandboxRun(sandbox, command);
        const combined = [
          result.stdout ? `stdout:\n${result.stdout}` : "",
          result.stderr ? `stderr:\n${result.stderr}` : "",
          `exit code: ${result.exitCode}`,
        ]
          .filter(Boolean)
          .join("\n");
        return combined.length > 8000 ? combined.slice(0, 8000) + "\n[truncated]" : combined;
      },
    }),

    // ----------------------------------------------------------
    // Glob — find files matching a pattern
    // ----------------------------------------------------------
    Glob: tool({
      description:
        "Find files matching a glob pattern in the workspace. Returns a list of matching file paths.",
      inputSchema: zodSchema(
        z.object({
          pattern: z
            .string()
            .describe(
              "Glob pattern (e.g. 'src/**/*.tsx', '**/*.json', 'src/app/**/*.ts')"
            ),
        })
      ),
      execute: async ({ pattern }: { pattern: string }) => {
        const namePattern = pattern.split("/").pop() ?? "*";
        const regexPart = globToRegex(pattern);
        const cmd = `find /workspace -type f -name "${namePattern}" 2>/dev/null | grep -E "${regexPart}" | sort`;
        const result = await sandboxRun(sandbox, cmd);
        if (!result.stdout.trim()) {
          return "No files found matching the pattern.";
        }
        return result.stdout
          .trim()
          .split("\n")
          .map((f) => f.replace("/workspace/", ""))
          .join("\n");
      },
    }),

    // ----------------------------------------------------------
    // Grep — search file contents
    // ----------------------------------------------------------
    Grep: tool({
      description:
        "Search for a pattern in file contents across the workspace. Returns matching lines with file paths.",
      inputSchema: zodSchema(
        z.object({
          pattern: z.string().describe("Search pattern (regex or literal string)"),
          path: z
            .string()
            .optional()
            .describe(
              "File or directory to search (relative to /workspace/). Defaults to entire workspace."
            ),
          include: z
            .string()
            .optional()
            .describe("File glob to restrict search (e.g. '*.tsx', '*.ts')"),
        })
      ),
      execute: async ({
        pattern,
        path,
        include,
      }: {
        pattern: string;
        path?: string;
        include?: string;
      }) => {
        const target = path ? `/workspace/${path}` : "/workspace";
        const includeFlag = include
          ? `--include="${include}"`
          : "--include='*.ts' --include='*.tsx' --include='*.js' --include='*.json'";
        const escapedPattern = pattern.replace(/"/g, '\\"');
        const cmd = `grep -rn ${includeFlag} "${escapedPattern}" "${target}" 2>/dev/null | head -50`;
        const result = await sandboxRun(sandbox, cmd);
        if (!result.stdout.trim()) {
          return "No matches found.";
        }
        return result.stdout
          .split("\n")
          .map((line) => line.replace("/workspace/", ""))
          .join("\n");
      },
    }),

    // ----------------------------------------------------------
    // Delete — remove a file from /workspace/
    // ----------------------------------------------------------
    Delete: tool({
      description: "Delete a file from the workspace.",
      inputSchema: zodSchema(
        z.object({
          path: z.string().describe("File path relative to /workspace/"),
        })
      ),
      execute: async ({ path }: { path: string }) => {
        await sandboxDeleteFile(sandbox, path);
        onFileChange({ path, content: "", operation: "delete" });
        return `Deleted: ${path}`;
      },
    }),

    // ----------------------------------------------------------
    // ListFiles — list files in a directory
    // ----------------------------------------------------------
    ListFiles: tool({
      description: "List all files in a directory of the workspace.",
      inputSchema: zodSchema(
        z.object({
          path: z
            .string()
            .optional()
            .describe("Directory path relative to /workspace/. Defaults to root."),
        })
      ),
      execute: async ({ path }: { path?: string }) => {
        const files = await sandboxListFiles(sandbox, path ?? "");
        if (files.length === 0) {
          return "Directory is empty or does not exist.";
        }
        return files.join("\n");
      },
    }),
  };
}

// ============================================================
// Helpers
// ============================================================

function globToRegex(pattern: string): string {
  return pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");
}

// ============================================================
// Tool name sets — used by agent-runner to restrict available tools
// ============================================================

export type AgentToolName = keyof ReturnType<typeof createAgentTools>;

export const INTAKE_TOOLS: AgentToolName[] = ["Read", "ListFiles"];

export const BUILD_TOOLS: AgentToolName[] = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Glob",
  "Grep",
  "Delete",
  "ListFiles",
];

export const ITERATE_TOOLS: AgentToolName[] = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Glob",
  "Grep",
  "Delete",
  "ListFiles",
];
