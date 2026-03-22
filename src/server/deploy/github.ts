// FYREN — GitHub push module
// Pushes /workspace/ files from the E2B sandbox to the client's GitHub repo.
//
// Security rules:
//   - GitHub token is decrypted in-memory only, never logged, never persisted in plain
//   - sanitizeForLog strips tokens from any error messages before logging
//
// Flow:
//   1. Decrypt the client's GitHub token from service_connections
//   2. Collect all files from the sandbox /workspace/
//   3. Create the repo if it doesn't exist (or use existing repo)
//   4. Commit all files in a single tree push (one atomic commit)

import { Octokit } from "@octokit/rest";
import type { Sandbox } from "e2b";
import { decrypt } from "@/lib/crypto";
import { sanitizeForLog } from "@/server/deploy/utils";

// ============================================================
// Types
// ============================================================

export interface GitHubPushOptions {
  /** Decrypted GitHub OAuth token from service_connections */
  token: string;
  /** Target repo name (e.g. "my-app") */
  repoName: string;
  /** Sandbox instance to read /workspace/ files from */
  sandbox: Sandbox;
  /** Commit message */
  commitMessage?: string;
  /** If true, create the repo if it doesn't exist */
  createIfNotExists?: boolean;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface GitHubPushResult {
  repoUrl: string;
  repoFullName: string; // "owner/repo"
  commitSha: string;
  branch: string;
}

// ============================================================
// Main export
// ============================================================

/**
 * Push all files from the E2B sandbox /workspace/ to the client's GitHub repo.
 * Returns the repo URL and commit SHA for Vercel to reference.
 */
export async function pushToGitHub(opts: GitHubPushOptions): Promise<GitHubPushResult> {
  const {
    token,
    repoName,
    sandbox,
    commitMessage = "Initial build by FYREN",
    createIfNotExists = true,
    onProgress,
  } = opts;

  const octokit = new Octokit({ auth: token });

  onProgress?.("Récupération du profil GitHub...");

  // Get authenticated user (owner login)
  const { data: ghUser } = await octokit.rest.users.getAuthenticated();
  const owner = ghUser.login;

  onProgress?.(`GitHub connecté : ${owner}`);

  // Ensure repo exists
  const repo = await ensureRepo(octokit, owner, repoName, createIfNotExists, onProgress);
  const defaultBranch = repo.default_branch;

  onProgress?.("Lecture des fichiers du workspace sandbox...");

  // Collect all workspace files
  const files = await collectWorkspaceFiles(sandbox);
  onProgress?.(`${files.length} fichiers collectés`);

  if (files.length === 0) {
    throw new Error("Le workspace sandbox est vide — aucun fichier à pusher");
  }

  onProgress?.("Création du commit GitHub...");

  // Build the git tree and push one atomic commit
  const commitSha = await pushCommit({
    octokit,
    owner,
    repo: repoName,
    branch: defaultBranch,
    files,
    message: commitMessage,
    onProgress,
  });

  const repoUrl = `https://github.com/${owner}/${repoName}`;

  onProgress?.(`Push GitHub terminé — ${repoUrl}`);

  return {
    repoUrl,
    repoFullName: `${owner}/${repoName}`,
    commitSha,
    branch: defaultBranch,
  };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Decrypt the GitHub token from service_connections config JSONB.
 * config shape: { encrypted_token: "<base64>", login: "username" }
 */
export async function decryptGitHubToken(config: Record<string, string>): Promise<string> {
  const encrypted = config["encrypted_token"];
  if (!encrypted) throw new Error("Token GitHub chiffré introuvable dans la config");
  return await decrypt(encrypted);
}

interface RepoData {
  default_branch: string;
}

async function ensureRepo(
  octokit: Octokit,
  owner: string,
  repoName: string,
  createIfNotExists: boolean,
  onProgress?: (msg: string) => void
): Promise<RepoData> {
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo: repoName });
    onProgress?.(`Repo existant trouvé : ${owner}/${repoName}`);
    return { default_branch: data.default_branch };
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status !== 404) {
      throw new Error(sanitizeForLog(`Erreur GitHub repos.get: ${String(err)}`));
    }
  }

  if (!createIfNotExists) {
    throw new Error(`Repo ${owner}/${repoName} introuvable et createIfNotExists=false`);
  }

  onProgress?.(`Création du repo ${owner}/${repoName}...`);

  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name: repoName,
    description: "Built with FYREN — fyren.app",
    private: false,
    auto_init: true, // Creates an initial commit so we can reference HEAD
  });

  onProgress?.(`Repo créé : ${data.html_url}`);
  return { default_branch: data.default_branch };
}

interface WorkspaceFile {
  path: string; // relative to /workspace/
  content: string;
}

async function collectWorkspaceFiles(sandbox: Sandbox): Promise<WorkspaceFile[]> {
  // List all files under /workspace/
  const listResult = await sandbox.commands.run(
    "find /workspace -type f ! -path '*/node_modules/*' ! -path '*/.git/*' ! -path '*/.next/*' | sort"
  );

  const paths = listResult.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const files: WorkspaceFile[] = [];

  for (const absolutePath of paths) {
    const content = await sandbox.files.read(absolutePath);
    const relativePath = absolutePath.replace(/^\/workspace\//, "");
    files.push({ path: relativePath, content });
  }

  return files;
}

interface PushCommitOptions {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
  files: WorkspaceFile[];
  message: string;
  onProgress?: (msg: string) => void;
}

async function pushCommit(opts: PushCommitOptions): Promise<string> {
  const { octokit, owner, repo, branch, files, message, onProgress } = opts;

  // Get the current HEAD commit SHA
  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const baseCommitSha = ref.object.sha;

  // Get the tree of the base commit
  const { data: baseCommit } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: baseCommitSha,
  });
  const baseTreeSha = baseCommit.tree.sha;

  onProgress?.(`Construction de l'arbre git (${files.length} fichiers)...`);

  // Create blobs for all files (batched to avoid rate limits)
  const treeItems: {
    path: string;
    mode: "100644";
    type: "blob";
    sha: string;
  }[] = [];

  for (const file of files) {
    const { data: blob } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Buffer.from(file.content).toString("base64"),
      encoding: "base64",
    });
    treeItems.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // Create the new tree
  const { data: newTree } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // Create the commit
  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [baseCommitSha],
  });

  // Update the branch ref
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
    force: false,
  });

  onProgress?.(`Commit créé : ${newCommit.sha.slice(0, 7)}`);
  return newCommit.sha;
}
