import crypto from "crypto";
import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { RESUME_SCREENING_CONFIG } from "../../../shared/constants";
import type { ResumeProcessingStatus } from "../../../shared/types";
import { config } from "../config";
import { logEvent } from "./audit";

export interface PdfExtractionResult {
  ok: boolean;
  status: ResumeProcessingStatus;
  pageCount: number | null;
  extractedText: string;
  pageAnnotatedText: string;
  extractionReference: string;
  failureCode: string | null;
  failureMessageSafe: string | null;
}

export function isPdfMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function validateUploadBuffer(params: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}): { valid: true } | { valid: false; code: string; message: string } {
  if (!params.buffer || params.buffer.length === 0) {
    return { valid: false, code: "EMPTY_FILE", message: "Uploaded file is empty." };
  }
  if (params.buffer.length > config.resumeMaxSizeBytes) {
    return {
      valid: false,
      code: "FILE_TOO_LARGE",
      message: `Resume exceeds maximum size of ${Math.round(
        config.resumeMaxSizeBytes / (1024 * 1024)
      )} MB.`,
    };
  }
  if (!isPdfMagicBytes(params.buffer)) {
    return {
      valid: false,
      code: "INVALID_PDF_SIGNATURE",
      message: "Invalid file content. Only genuine PDF documents are accepted.",
    };
  }
  return { valid: true };
}

export async function extractPdfContent(buffer: Buffer): Promise<PdfExtractionResult> {
  const extractionReference = `ext_${crypto.randomUUID().slice(0, 12)}`;

  if (!isPdfMagicBytes(buffer)) {
    return {
      ok: false,
      status: "rejected",
      pageCount: null,
      extractedText: "",
      pageAnnotatedText: "",
      extractionReference,
      failureCode: "INVALID_PDF_SIGNATURE",
      failureMessageSafe: "The file is not a valid PDF document.",
    };
  }

  try {
    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useWorkerFetch: false,
      verbosity: 0,
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    if (numPages > config.resumeMaxPages) {
      await pdfDoc.cleanup();
      return {
        ok: false,
        status: "rejected",
        pageCount: numPages,
        extractedText: "",
        pageAnnotatedText: "",
        extractionReference,
        failureCode: "PAGE_LIMIT_EXCEEDED",
        failureMessageSafe: `Resume has ${numPages} pages; maximum allowed is ${config.resumeMaxPages} pages.`,
      };
    }

    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean);
      const lineText = strings.join(" ").replace(/\s+/g, " ").trim();
      pageTexts.push(`[Page ${pageNum}]\n${lineText}`);
    }
    await pdfDoc.cleanup();

    const pageAnnotatedText = pageTexts.join("\n\n").trim();
    const rawText = pageTexts
      .map((t) => t.replace(/^\[Page \d+\]\n/, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (
      rawText.length < RESUME_SCREENING_CONFIG.minExtractedChars ||
      rawText.length < numPages * RESUME_SCREENING_CONFIG.minCharsPerPage
    ) {
      logEvent("warn", "resume_extraction_low_text", {
        extractionReference,
        numPages,
        charCount: rawText.length,
        ocrEnabled: config.ocrEnabled,
      });
      return {
        ok: false,
        status: "extraction_failed",
        pageCount: numPages,
        extractedText: rawText,
        pageAnnotatedText,
        extractionReference,
        failureCode: "SCANNED_OR_EMPTY_PDF",
        failureMessageSafe:
          "This PDF appears to be an image-only scan or contains insufficient readable text. OCR is not enabled; please upload a text-selectable PDF resume.",
      };
    }

    return {
      ok: true,
      status: "extracted",
      pageCount: numPages,
      extractedText: rawText,
      pageAnnotatedText,
      extractionReference,
      failureCode: null,
      failureMessageSafe: null,
    };
  } catch (err: unknown) {
    const errObj = err as { name?: string; message?: string };
    const isPassword =
      errObj?.name === "PasswordException" ||
      (errObj?.message || "").toLowerCase().includes("password");

    logEvent("warn", "resume_extraction_error", {
      extractionReference,
      errorName: errObj?.name || "UnknownError",
      isPassword,
    });

    return {
      ok: false,
      status: "extraction_failed",
      pageCount: null,
      extractedText: "",
      pageAnnotatedText: "",
      extractionReference,
      failureCode: isPassword ? "PASSWORD_PROTECTED_PDF" : "CORRUPT_OR_UNREADABLE_PDF",
      failureMessageSafe: isPassword
        ? "Password-protected PDFs cannot be processed. Please remove password protection and upload again."
        : "The uploaded PDF appears corrupted or unreadable. Please re-export as a standard PDF and retry.",
    };
  }
}

export function storePrivateResumeFile(params: {
  companyId: string;
  jobId: string;
  fileId: string;
  buffer: Buffer;
}): string {
  const relKey = path.join("resumes", params.companyId, params.jobId, `${params.fileId}.pdf`);
  const fullPath = path.join(config.privateStorageDir, relKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, params.buffer);
  return relKey;
}

export function readPrivateResumeFile(storageKey: string): Buffer | null {
  const safePath = path.resolve(config.privateStorageDir, storageKey);
  if (!safePath.startsWith(path.resolve(config.privateStorageDir))) {
    return null;
  }
  if (!fs.existsSync(safePath)) return null;
  return fs.readFileSync(safePath);
}

export function createSignedDownloadToken(params: {
  fileId: string;
  userId: string;
  ttlSeconds?: number;
}): { token: string; expiresAt: number } {
  const expiresAt =
    Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? config.signedUrlTtlSeconds);
  const payload = `${params.fileId}:${params.userId}:${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", config.signedUrlSecret)
    .update(payload)
    .digest("hex");
  const token = Buffer.from(`${payload}:${sig}`).toString("base64url");
  return { token, expiresAt };
}

export function verifySignedDownloadToken(
  token: string,
  expectedFileId: string
): { valid: true; userId: string } | { valid: false; reason: string } {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return { valid: false, reason: "Malformed signature token." };
    const [fileId, userId, expStr, sig] = parts;
    if (fileId !== expectedFileId) {
      return { valid: false, reason: "Token does not match target resume file." };
    }
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) {
      return { valid: false, reason: "Signed download link has expired." };
    }
    const expectedSig = crypto
      .createHmac("sha256", config.signedUrlSecret)
      .update(`${fileId}:${userId}:${expStr}`)
      .digest("hex");
    const sigBuf = Buffer.from(sig, "utf8");
    const expBuf = Buffer.from(expectedSig, "utf8");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, reason: "Invalid download signature." };
    }
    return { valid: true, userId };
  } catch {
    return { valid: false, reason: "Invalid download token." };
  }
}
