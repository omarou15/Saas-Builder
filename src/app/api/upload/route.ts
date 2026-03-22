// POST /api/upload — Process an uploaded file for the agent context
//
// Accepts multipart/form-data with a single file field named "file".
// Extracts content based on file type:
//   - PDF → text extraction via pdf-parse
//   - Images (png, jpg, webp, gif) → base64 (resized if > 5MB)
//   - Code/text files (.ts, .tsx, .js, .json, .md, .txt, .css, .html, .py, .sql, .yaml, .yml, .env.example)
//     → raw text content
//
// Returns: { type: "text" | "image", content: string, filename: string, mimeType: string }
//
// Limits: 10MB max file size
// Security: Clerk auth required, rate limited, filenames sanitized

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getUserByClerkId } from "@/lib/credits";
import { sanitizeForLog } from "@/lib/utils";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_RESIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB — resize images above this

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt", ".css", ".html",
  ".py", ".sql", ".yaml", ".yml", ".toml", ".sh", ".bash", ".zsh",
  ".env.example", ".gitignore", ".prettierrc", ".eslintrc",
  ".svelte", ".vue", ".go", ".rs", ".java", ".kt", ".swift",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
]);

export async function POST(req: Request): Promise<Response> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit: 30 uploads per minute
  const rl = rateLimit(`${clerkId}:upload`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop d'uploads. Attendez une minute." },
      { status: 429 }
    );
  }

  // Verify user exists
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide — multipart/form-data attendu" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier trouvé (champ 'file' requis)" }, { status: 400 });
  }

  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite : 10MB.` },
      { status: 413 }
    );
  }

  const filename = sanitizeForLog(file.name);
  const mimeType = file.type;
  const ext = getExtension(file.name);

  try {
    // ── PDF ──────────────────────────────────────
    if (mimeType === "application/pdf" || ext === ".pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const pdfParse = (await import("pdf-parse")).default;
      const pdf = await pdfParse(buffer);
      const text = pdf.text.trim();

      if (!text) {
        return NextResponse.json(
          { error: "PDF vide ou impossible à extraire (peut-être un scan image)." },
          { status: 422 }
        );
      }

      // Truncate very long PDFs to avoid blowing up context
      const truncated = text.length > 50_000 ? text.slice(0, 50_000) + "\n\n[... tronqué à 50 000 caractères]" : text;

      return NextResponse.json({
        type: "text" as const,
        content: truncated,
        filename,
        mimeType: "application/pdf",
        pages: pdf.numpages,
      });
    }

    // ── Images ───────────────────────────────────
    if (IMAGE_MIME_TYPES.has(mimeType)) {
      const arrayBuffer = await file.arrayBuffer();
      let imgBuffer: Buffer = Buffer.from(arrayBuffer);

      // Resize if > 5MB to reduce token cost
      if (imgBuffer.length > IMAGE_RESIZE_THRESHOLD) {
        const sharp = (await import("sharp")).default;
        imgBuffer = await sharp(imgBuffer)
          .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
      }

      const base64 = imgBuffer.toString("base64");
      const outputMime = imgBuffer.length < file.size && mimeType !== "image/jpeg"
        ? "image/jpeg"
        : mimeType;

      return NextResponse.json({
        type: "image" as const,
        content: `data:${outputMime};base64,${base64}`,
        filename,
        mimeType: outputMime,
        originalSize: file.size,
        processedSize: imgBuffer.length,
      });
    }

    // ── Text/Code files ──────────────────────────
    if (TEXT_EXTENSIONS.has(ext) || mimeType.startsWith("text/")) {
      const text = await file.text();

      // Truncate very large text files
      const truncated = text.length > 100_000
        ? text.slice(0, 100_000) + "\n\n[... tronqué à 100 000 caractères]"
        : text;

      return NextResponse.json({
        type: "text" as const,
        content: truncated,
        filename,
        mimeType: mimeType || "text/plain",
      });
    }

    // ── Unsupported type ─────────────────────────
    return NextResponse.json(
      {
        error: `Type de fichier non supporté : ${ext || mimeType}. Formats acceptés : PDF, images (PNG/JPG/WebP), fichiers code/texte.`,
      },
      { status: 415 }
    );
  } catch (err) {
    console.error(
      `[upload] Error processing ${sanitizeForLog(filename)}:`,
      err instanceof Error ? err.message : "unknown"
    );
    return NextResponse.json(
      { error: "Erreur lors du traitement du fichier." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}
