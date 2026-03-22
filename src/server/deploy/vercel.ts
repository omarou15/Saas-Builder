// FYREN — Vercel deploy module
// Creates a Vercel project linked to the client's GitHub repo, injects their env vars,
// then lets the standard GitHub → Vercel Git integration trigger the actual build/deploy.
//
// Security rules:
//   - Vercel token is decrypted in-memory only, never logged
//   - Client env vars are set on THEIR Vercel project, not on FYREN's
//   - sanitizeForLog used on every error path
//
// Flow:
//   1. Init Vercel SDK with the client's token
//   2. Create (or retrieve) Vercel project and link to the client's GitHub repo
//   3. Set all required env vars on that project
//   4. Return the deployment URL (the push in github.ts triggers the actual deploy)

import { Vercel } from "@vercel/sdk";
import { decrypt } from "@/lib/crypto";
import { sanitizeForLog, errorMessage } from "@/server/deploy/utils";

// ============================================================
// Types
// ============================================================

export interface EnvVar {
  key: string;
  value: string;
  /** Defaults to ["production", "preview", "development"] */
  targets?: Array<"production" | "preview" | "development">;
}

export interface VercelSetupOptions {
  /** Decrypted Vercel token from service_connections */
  token: string;
  /** Vercel project name to create */
  projectName: string;
  /** The "owner/repo" string returned by pushToGitHub */
  githubRepoFullName: string;
  /** Environment variables to inject into the project */
  envVars: EnvVar[];
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface VercelSetupResult {
  projectId: string;
  projectUrl: string; // https://vercel.com/[username]/[project]
  deploymentUrl: string; // https://[project].vercel.app
}

// ============================================================
// Main export
// ============================================================

/**
 * Create (or retrieve) a Vercel project linked to the client's GitHub repo
 * and configure their env vars. The Git push already done in github.ts will
 * trigger the deploy automatically via the standard Vercel Git integration.
 */
export async function setupVercelProject(opts: VercelSetupOptions): Promise<VercelSetupResult> {
  const { token, projectName, githubRepoFullName, envVars, onProgress } = opts;

  const sdk = new Vercel({ bearerToken: token });

  onProgress?.("Connexion Vercel...");

  // Check who the token belongs to (for building URLs)
  const userInfo = await getVercelUser(token);
  onProgress?.(`Vercel connecté : ${userInfo.username}`);

  // Create the project (idempotent via error handling)
  onProgress?.(`Création du projet Vercel "${projectName}"...`);
  const project = await ensureProject(sdk, projectName, githubRepoFullName, onProgress);

  onProgress?.(`Projet Vercel créé : ${project.id}`);

  // Inject env vars
  if (envVars.length > 0) {
    onProgress?.(`Injection de ${envVars.length} variables d'environnement...`);
    await injectEnvVars(sdk, project.id, envVars, onProgress);
  }

  const deploymentUrl = `https://${projectName}.vercel.app`;
  const projectUrl = `https://vercel.com/${userInfo.username}/${projectName}`;

  onProgress?.(`Vercel configuré — ${deploymentUrl}`);

  return {
    projectId: project.id,
    projectUrl,
    deploymentUrl,
  };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Decrypt the Vercel token from service_connections config JSONB.
 * config shape: { encrypted_token: "<base64>" }
 */
export async function decryptVercelToken(config: Record<string, string>): Promise<string> {
  const encrypted = config["encrypted_token"];
  if (!encrypted) throw new Error("Token Vercel chiffré introuvable dans la config");
  return await decrypt(encrypted);
}

interface VercelUser {
  username: string;
}

async function getVercelUser(token: string): Promise<VercelUser> {
  const res = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(sanitizeForLog(`Vercel user fetch failed: HTTP ${res.status}`));
  }
  const body = await res.json() as { user?: { username?: string } };
  return { username: body.user?.username ?? "unknown" };
}

interface ProjectResult {
  id: string;
  name: string;
}

async function ensureProject(
  sdk: Vercel,
  projectName: string,
  githubRepoFullName: string,
  onProgress?: (msg: string) => void
): Promise<ProjectResult> {
  try {
    const result = await sdk.projects.createProject({
      requestBody: {
        name: projectName,
        framework: "nextjs",
        gitRepository: {
          repo: githubRepoFullName,
          type: "github",
        },
        installCommand: "npm install",
        buildCommand: "npm run build",
        outputDirectory: ".next",
      },
    });

    return { id: result.id, name: result.name };
  } catch (err: unknown) {
    // If project already exists (409), retrieve it
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 409) {
      onProgress?.(`Projet Vercel "${projectName}" déjà existant — récupération...`);
      return await getExistingProject(sdk, projectName);
    }
    throw new Error(sanitizeForLog(`Vercel createProject failed: ${errorMessage(err)}`));
  }
}

async function getExistingProject(sdk: Vercel, idOrName: string): Promise<ProjectResult> {
  // The SDK returns a union type for getProjects — use REST directly for simplicity
  // We need the token from the SDK's underlying client — use a lightweight fetch instead
  // The sdk instance is not directly used here; we fall back to the Vercel REST API
  // via a raw call using the token already set on the sdk instance.
  //
  // Since we don't have easy access to the token here, use the update API to get the project.
  // updateProject with no changes will return the current state.
  try {
    const result = await sdk.projects.updateProject({
      idOrName,
      requestBody: {},
    });
    return { id: result.id, name: result.name };
  } catch (err: unknown) {
    throw new Error(sanitizeForLog(`Projet Vercel "${idOrName}" introuvable : ${errorMessage(err)}`));
  }
}

async function injectEnvVars(
  sdk: Vercel,
  projectId: string,
  envVars: EnvVar[],
  onProgress?: (msg: string) => void
): Promise<void> {
  const DEFAULT_TARGETS: Array<"production" | "preview" | "development"> = [
    "production",
    "preview",
    "development",
  ];

  // Batch all env vars in one request (array form)
  const requestBody = envVars.map((v) => ({
    key: v.key,
    value: v.value,
    type: "encrypted" as const,
    target: v.targets ?? DEFAULT_TARGETS,
    customEnvironmentIds: [] as string[],
  }));

  try {
    await sdk.projects.createProjectEnv({
      idOrName: projectId,
      upsert: "true",
      requestBody,
    });
    onProgress?.(`${envVars.length} variables d'environnement injectées`);
  } catch (err: unknown) {
    // Non-fatal: log and continue. Env vars can be added manually by the client.
    console.error(
      "[Vercel] createProjectEnv error:",
      sanitizeForLog(errorMessage(err))
    );
    onProgress?.(`Avertissement : erreur injection env vars — ${sanitizeForLog(errorMessage(err))}`);
  }
}
