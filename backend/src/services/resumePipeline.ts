import crypto from "crypto";
import { RESUME_SCREENING_CONFIG } from "../../../shared/constants";
import type {
  ApplicationRecord,
  JobEvaluationProfile,
  ResumeEvaluationRecord,
  ResumeFileRecord,
} from "../../../shared/types";
import { config } from "../config";
import { db } from "../db/database";
import { evaluateResumeWithAI } from "./ai";
import { writeAuditLog, logEvent } from "./audit";
import {
  extractPdfContent,
  readPrivateResumeFile,
  storePrivateResumeFile,
} from "./pdfProcessor";

export async function processResumeAndEvaluateApplication(params: {
  application: ApplicationRecord;
  resumeFile: ResumeFileRecord;
  pdfBuffer?: Buffer;
  requestId?: string;
}): Promise<{
  resumeFile: ResumeFileRecord;
  evaluation: ResumeEvaluationRecord | null;
  application: ApplicationRecord;
}> {
  const now = new Date().toISOString();
  const buffer = params.pdfBuffer ?? readPrivateResumeFile(params.resumeFile.storageKey);

  if (!buffer) {
    const failedFile = (await db.resumeFiles.updateById(params.resumeFile.id, {
      processingStatus: "extraction_failed",
      failureCode: "FILE_MISSING",
      failureMessageSafe: "Stored resume file could not be read.",
    }))!;
    const updatedApp = (await db.applications.updateById(params.application.id, {
      resumeProcessingStatus: "extraction_failed",
      evaluationStatus: "failed",
      screeningResult: "not_determined",
      weightedScore: null,
      applicationStatus: "screening_failed",
      reviewFlags: ["Resume file missing from storage"],
      updatedAt: now,
    }))!;
    return { resumeFile: failedFile, evaluation: null, application: updatedApp };
  }

  // 1. Extract text safely via pdfjs-dist
  const extraction = await extractPdfContent(buffer);
  const updatedFile = (await db.resumeFiles.updateById(params.resumeFile.id, {
    processingStatus: extraction.status,
    pageCount: extraction.pageCount,
    extractionReference: extraction.extractionReference,
    extractedTextLength: extraction.extractedText.length,
    failureCode: extraction.failureCode,
    failureMessageSafe: extraction.failureMessageSafe,
  }))!;

  if (!extraction.ok) {
    await db.applications.updateById(params.application.id, {
      resumeProcessingStatus: extraction.status,
      evaluationStatus: "failed",
      screeningResult: "not_determined",
      weightedScore: null,
      applicationStatus: "screening_failed",
      reviewFlags: [extraction.failureMessageSafe || "Resume extraction failed"],
      updatedAt: new Date().toISOString(),
    });
    const appAfter = (await db.applications.findById(params.application.id))!;

    await writeAuditLog({
      actorId: "system",
      actorRole: "system",
      action: "resume_extraction_failed",
      targetType: "application",
      targetId: params.application.id,
      companyId: params.application.companyId,
      reason: extraction.failureCode,
      requestId: params.requestId,
    });

    return { resumeFile: updatedFile, evaluation: null, application: appAfter };
  }

  // 2. Load latest READY job evaluation profile
  const job = await db.jobs.findById(params.application.jobId);
  let profile: JobEvaluationProfile | null = null;
  if (job?.activeEvaluationProfileId) {
    const candidateProfile = await db.jobEvaluationProfiles.findById(
      job.activeEvaluationProfileId
    );
    if (candidateProfile && candidateProfile.status === "ready") {
      profile = candidateProfile;
    }
  }

  if (!profile) {
    const pendingApp = (await db.applications.updateById(params.application.id, {
      resumeProcessingStatus: "extracted",
      evaluationStatus: "pending",
      screeningResult: "not_determined",
      weightedScore: null,
      applicationStatus: "screening_in_progress",
      reviewFlags: ["Waiting for ready job evaluation profile"],
      updatedAt: new Date().toISOString(),
    }))!;
    return { resumeFile: updatedFile, evaluation: null, application: pendingApp };
  }

  // 3. Idempotency check: reuse existing completed evaluation for exact profile + file version
  const existingEval = await db.resumeEvaluations.findOne(
    (e) =>
      e.applicationId === params.application.id &&
      e.jobEvaluationProfileVersion === profile!.profileVersion &&
      e.rubricVersion === RESUME_SCREENING_CONFIG.rubricVersion &&
      (e.evaluationStatus === "completed" || e.evaluationStatus === "needs_review")
  );
  if (existingEval) {
    const appAfter = (await db.applications.findById(params.application.id))!;
    return { resumeFile: updatedFile, evaluation: existingEval, application: appAfter };
  }

  // 4. Mark processing
  await db.applications.updateById(params.application.id, {
    resumeProcessingStatus: "extracted",
    evaluationStatus: "processing",
    applicationStatus: "screening_in_progress",
    updatedAt: new Date().toISOString(),
  });

  const evalId = `evl_${crypto.randomUUID().slice(0, 12)}`;
  const startTime = new Date().toISOString();

  try {
    const aiResult = await evaluateResumeWithAI({
      profile,
      pageAnnotatedResumeText: extraction.pageAnnotatedText,
    });

    const evalStatus = aiResult.needsHumanReview ? "needs_review" : "completed";
    const appStatus = aiResult.needsHumanReview
      ? "screening_needs_review"
      : "screening_completed";

    const evaluation: ResumeEvaluationRecord = {
      id: evalId,
      applicationId: params.application.id,
      candidateId: params.application.candidateId,
      jobId: params.application.jobId,
      companyId: params.application.companyId,
      resumeFileId: updatedFile.id,
      resumeFileVersion: updatedFile.version,
      extractionStatus: updatedFile.processingStatus,
      extractionReference: extraction.extractionReference,
      evaluationStatus: evalStatus,
      screeningResult: aiResult.screeningResult,
      categoryScores: aiResult.categoryScores,
      categoryEvaluations: aiResult.evaluation.categories,
      weightedScore: aiResult.weightedScore,
      qualificationThreshold: RESUME_SCREENING_CONFIG.qualificationThreshold,
      isReferralAtEvaluation: params.application.isReferral,
      jobEvaluationProfileId: profile.id,
      jobEvaluationProfileVersion: profile.profileVersion,
      rubricVersion: RESUME_SCREENING_CONFIG.rubricVersion,
      model: config.geminiModel,
      promptVersion: "resume-eval-v1",
      overallObservations: aiResult.evaluation.overallObservations,
      reviewFlags: aiResult.reviewReasons,
      failureCode: null,
      failureMessageSafe: null,
      createdAt: startTime,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    await db.resumeEvaluations.insert(evaluation);

    const updatedApp = (await db.applications.updateById(params.application.id, {
      resumeProcessingStatus: "extracted",
      evaluationStatus: evalStatus,
      screeningResult: aiResult.screeningResult,
      weightedScore: aiResult.weightedScore,
      applicationStatus: appStatus,
      reviewFlags: aiResult.reviewReasons,
      updatedAt: new Date().toISOString(),
    }))!;

    await writeAuditLog({
      actorId: "system",
      actorRole: "system",
      action: "resume_evaluation_completed",
      targetType: "application",
      targetId: params.application.id,
      companyId: params.application.companyId,
      newState: {
        evaluationId: evalId,
        profileVersion: profile.profileVersion,
        rubricVersion: RESUME_SCREENING_CONFIG.rubricVersion,
        weightedScore: aiResult.weightedScore,
        screeningResult: aiResult.screeningResult,
        evaluationStatus: evalStatus,
      },
      requestId: params.requestId,
    });

    return { resumeFile: updatedFile, evaluation, application: updatedApp };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "AI evaluation failed.";
    const safeMsg = errMsg.includes("GEMINI_API_KEY")
      ? "Server Gemini API key is not configured. Please retry once configured."
      : "AI resume evaluation failed due to an upstream error. You can retry evaluation without resubmitting.";

    logEvent("error", "resume_evaluation_failed", {
      applicationId: params.application.id,
      evalId,
      error: errMsg,
      requestId: params.requestId,
    });

    const failedEval: ResumeEvaluationRecord = {
      id: evalId,
      applicationId: params.application.id,
      candidateId: params.application.candidateId,
      jobId: params.application.jobId,
      companyId: params.application.companyId,
      resumeFileId: updatedFile.id,
      resumeFileVersion: updatedFile.version,
      extractionStatus: updatedFile.processingStatus,
      extractionReference: extraction.extractionReference,
      evaluationStatus: "failed",
      screeningResult: "not_determined",
      categoryScores: null,
      categoryEvaluations: [],
      weightedScore: null,
      qualificationThreshold: RESUME_SCREENING_CONFIG.qualificationThreshold,
      isReferralAtEvaluation: params.application.isReferral,
      jobEvaluationProfileId: profile.id,
      jobEvaluationProfileVersion: profile.profileVersion,
      rubricVersion: RESUME_SCREENING_CONFIG.rubricVersion,
      model: config.geminiModel,
      promptVersion: "resume-eval-v1",
      overallObservations: [],
      reviewFlags: [safeMsg],
      failureCode: errMsg.includes("GEMINI_API_KEY")
        ? "MISSING_GEMINI_API_KEY"
        : "AI_EVALUATION_ERROR",
      failureMessageSafe: safeMsg,
      createdAt: startTime,
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    await db.resumeEvaluations.insert(failedEval);

    const failedApp = (await db.applications.updateById(params.application.id, {
      resumeProcessingStatus: "extracted",
      evaluationStatus: "failed",
      screeningResult: "not_determined",
      weightedScore: null,
      applicationStatus: "screening_failed",
      reviewFlags: [safeMsg],
      updatedAt: new Date().toISOString(),
    }))!;

    return { resumeFile: updatedFile, evaluation: failedEval, application: failedApp };
  }
}

export function createResumeFileRecord(params: {
  companyId: string;
  jobId: string;
  candidateId: string;
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
}): ResumeFileRecord {
  const fileId = `res_${crypto.randomUUID().slice(0, 12)}`;
  const storageKey = storePrivateResumeFile({
    companyId: params.companyId,
    jobId: params.jobId,
    fileId,
    buffer: params.buffer,
  });

  return {
    id: fileId,
    candidateId: params.candidateId,
    jobId: params.jobId,
    companyId: params.companyId,
    originalFilename: params.originalFilename || "resume.pdf",
    mimeType: params.mimeType || "application/pdf",
    sizeBytes: params.buffer.length,
    pageCount: null,
    storageKey,
    processingStatus: "uploaded",
    extractionReference: "",
    extractedTextLength: 0,
    failureCode: null,
    failureMessageSafe: null,
    version: "1",
    createdAt: new Date().toISOString(),
  };
}
