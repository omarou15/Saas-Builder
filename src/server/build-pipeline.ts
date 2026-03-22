// FYREN Build Pipeline — state machine that orchestrates app generation
// Each stage has its own model config, system prompt context, and tools.
// See docs/05-task-distribution.md for the full architecture.
//
// Usage: the pipeline is driven by the agent API routes.
// Stage transitions are persisted to projects.status in Supabase.

import type { BuildStage } from "@/types";
import { INTAKE_PROMPT, BUILD_PROMPT, ITERATE_PROMPT } from "@/server/agent/prompts";

// ============================================================
// Types
// ============================================================

interface StageConfig {
  model: string | null;
  systemPrompt: string | null;
  tools: string[];
  maxTurns: number;
  skills: string[];
  /** Human-readable stage name for UI display */
  label: string;
  /** Progress percentage when this stage completes (0-100) */
  progressOnComplete: number;
}

// ============================================================
// Stage configuration
// Each AI stage has: model, prompt, tools, maxTurns, skills
// Non-AI stages (connect, deploy, done) have null model/prompt
// ============================================================

export const STAGE_CONFIG: Record<BuildStage, StageConfig> = {
  intake: {
    model: "anthropic/claude-sonnet-4-6",
    systemPrompt: INTAKE_PROMPT,
    tools: ["Read", "ListFiles"],
    maxTurns: 50,
    skills: [],
    label: "Intake — Analyse du projet",
    progressOnComplete: 10,
  },
  connect: {
    model: null,
    systemPrompt: null,
    tools: [],
    maxTurns: 0,
    skills: [],
    label: "Connect — Connexion des services",
    progressOnComplete: 20,
  },
  scaffold: {
    model: "anthropic/claude-haiku-4-5",
    systemPrompt: buildScaffoldPrompt(),
    tools: ["Write", "Bash", "ListFiles"],
    maxTurns: 10,
    skills: [],
    label: "Scaffold — Initialisation du projet",
    progressOnComplete: 30,
  },
  build_db: {
    model: "anthropic/claude-sonnet-4-6",
    systemPrompt: buildDbPrompt(),
    tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    maxTurns: 15,
    skills: [],
    label: "Build DB — Schéma base de données",
    progressOnComplete: 45,
  },
  build_backend: {
    model: "anthropic/claude-sonnet-4-6",
    systemPrompt: BUILD_PROMPT,
    tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Delete", "ListFiles"],
    maxTurns: 30,
    skills: ["react-best-practices"],
    label: "Build Backend — API routes & logique serveur",
    progressOnComplete: 65,
  },
  build_frontend: {
    model: "anthropic/claude-sonnet-4-6",
    systemPrompt: BUILD_PROMPT,
    tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Delete", "ListFiles"],
    maxTurns: 50,
    skills: [
      "frontend-design",
      "react-best-practices",
      "web-design-guidelines",
      "composition-patterns",
    ],
    label: "Build Frontend — Composants UI & pages",
    progressOnComplete: 85,
  },
  review: {
    model: "anthropic/claude-opus-4-6",
    systemPrompt: buildReviewPrompt(),
    tools: ["Read", "Glob", "Grep", "ListFiles"],
    maxTurns: 10,
    skills: ["web-design-guidelines"],
    label: "Review — Vérification qualité",
    progressOnComplete: 92,
  },
  deploy: {
    model: null,
    systemPrompt: null,
    tools: [],
    maxTurns: 0,
    skills: [],
    label: "Deploy — Push GitHub + Vercel",
    progressOnComplete: 100,
  },
  done: {
    model: null,
    systemPrompt: null,
    tools: [],
    maxTurns: 0,
    skills: [],
    label: "Done — Application déployée",
    progressOnComplete: 100,
  },
};

// ============================================================
// Stage ordering
// ============================================================

export const STAGE_ORDER: BuildStage[] = [
  "intake",
  "connect",
  "scaffold",
  "build_db",
  "build_backend",
  "build_frontend",
  "review",
  "deploy",
  "done",
];

export function nextStage(current: BuildStage): BuildStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] ?? null : null;
}

// ============================================================
// Stage prompts — generate the user message for each AI stage
// These are the first messages sent to the agent when a stage starts.
// ============================================================

export function buildStagePrompt(stage: BuildStage, cdc: unknown): string {
  const cdcJson = JSON.stringify(cdc, null, 2);

  switch (stage) {
    case "scaffold":
      return `The client's CDC (requirements) is ready. Your task is to initialize the workspace structure.

CDC:
${cdcJson}

Based on this CDC:
1. Read the current /workspace/package.json and existing structure (use ListFiles)
2. Add any npm dependencies required by the CDC (use Bash: npm install <pkg>)
3. Create the directory structure needed (src/app/, src/components/, src/lib/, etc.)
4. Create placeholder files for each major component (empty files are fine for now)

Focus on getting the structure right. Actual implementation comes in later stages.`;

    case "build_db":
      return `Your task is to create the database schema for the application.

CDC:
${cdcJson}

Steps:
1. Read the existing /workspace structure to understand what's there
2. Create /workspace/supabase/migrations/001_initial_schema.sql with:
   - All tables from the CDC
   - RLS enabled on ALL tables (mandatory)
   - RLS policies for authenticated users
   - Indexes on foreign keys and frequently queried columns
   - updated_at triggers where appropriate
3. Create /workspace/src/types/database.ts with TypeScript types for all tables

CRITICAL: RLS must be enabled on EVERY table. Never skip this.`;

    case "build_backend":
      return `Your task is to build the backend API routes and server logic.

CDC:
${cdcJson}

Based on the database schema already created:
1. Read existing files in /workspace/src/ to understand the structure
2. Create Next.js API routes in /workspace/src/app/api/
3. Implement server actions in /workspace/src/server/ if needed
4. Add Zod validation for all inputs
5. Use the Supabase client (process.env.NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
6. Follow existing Next.js 15 App Router conventions

Focus on correctness and security. No shortcuts on validation or error handling.`;

    case "build_frontend":
      return `Your task is to build the frontend UI — components, pages, and layout.

CDC:
${cdcJson}

Based on the backend already built:
1. Read existing API routes to understand the data shapes
2. Create React components in /workspace/src/components/
3. Create pages in /workspace/src/app/
4. Use shadcn/ui components (already installed)
5. Style with Tailwind 4 utility classes
6. Make it production-quality: responsive, accessible, polished

Design guidelines:
- Clean, modern aesthetic
- Consistent spacing (Tailwind spacing scale)
- Clear visual hierarchy
- Error states and loading states for all async operations`;

    case "review":
      return `Review the complete application for quality and correctness.

CDC (expected behavior):
${cdcJson}

Tasks:
1. Read all source files systematically
2. Check: TypeScript errors (no \`any\`, proper typing)
3. Check: Security (no hardcoded secrets, SQL injection risks, XSS vectors)
4. Check: Missing error handling (uncaught promises, empty catch blocks)
5. Check: RLS policies on all Supabase tables
6. Check: Responsive design (mobile-first)
7. Fix any issues found directly

Report what you fixed at the end.`;

    default:
      return `Stage: ${stage}\n\nCDC:\n${cdcJson}`;
  }
}

// ============================================================
// Stage-specific system prompt overrides
// (Scaffold and DB build use focused prompts, not the generic BUILD_PROMPT)
// ============================================================

function buildScaffoldPrompt(): string {
  return `You are a senior Next.js developer scaffolding a new application workspace.

Your task is ONLY to:
1. Set up the directory structure
2. Install required npm packages
3. Create empty placeholder files

Do NOT implement any logic yet. Focus on getting the structure perfectly aligned with the CDC.
Use ListFiles to see what's already there before creating anything.`.trim();
}

function buildDbPrompt(): string {
  return `You are a senior backend developer specializing in Supabase + Postgres.

Your task is to create a production-ready database schema.

MANDATORY rules:
- RLS (Row Level Security) MUST be enabled on EVERY table — no exceptions
- All foreign keys must have proper ON DELETE rules
- Use UUIDs (gen_random_uuid()) for primary keys
- Add updated_at columns with trigger functions for tables that change often
- Write RLS policies using the Clerk JWT pattern: (auth.jwt() ->> 'sub') = user_clerk_id

After writing SQL, also create matching TypeScript types in src/types/database.ts`.trim();
}

function buildReviewPrompt(): string {
  return `You are a senior code reviewer and security auditor.

Review the application with these priorities (in order):
1. Security: no hardcoded secrets, RLS on all tables, input validation
2. Correctness: TypeScript types, proper error handling, no silent catches
3. Completeness: does the code implement the CDC requirements?
4. Quality: readable, maintainable, follows conventions

For each issue found: identify it, explain why it's a problem, and fix it directly.
At the end, summarize all changes made.`.trim();
}

// ============================================================
// Re-export iterate prompt for use in agent runner
// ============================================================

export { ITERATE_PROMPT };
