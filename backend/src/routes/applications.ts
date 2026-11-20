import crypto from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import {
  PROTECTED_ATTRIBUTE_PATTERNS,
  RESUME_SCREENING_CONFIG,
  TIE_REASON_CODES,
} from "../../../shared/constants";
import type { ApplicationRecord, TieResolutionRecord } from "../../../shared/types";
import { config } from "../config";
import { db } from "../db/database";
import {
  assertCandidateAccess,
  assertCompanyAccess,
  requireAuth,
  requireRole,
} from "../middleware/auth";
import {
  detectExactTies,
  paginateCombinedList,
  rankApplicationRecords,
} from "../services/atsScoring";
import { writeAuditLog } from "../services/audit";
import { sendPlatformEmail } from "../services/email";
import {
  createSignedDownloadToken,
  readPrivateResumeFile,
  validateUploadBuffer,
  verifySignedDownloadToken,
} from "../services/pdfProcessor";
import {
  createResumeFileRecord,
  processResumeAndEvaluateApplication,
} from "../services/resumePipeline";

export const applicationsRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.resumeMaxSizeBytes + 1024 * 64,
    files: 1,
  },
});

const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  skip: () => config.isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many application attempts. Please wait a moment." },
});

// 1. Submit Application with PDF Resume + optional cover letter + optional referral
applicationsRouter.post(
  "/jobs/:jobId/apply",
  applyLimiter,
  requireAuth,
  requireRole("student"),
  (req, res, next) => {
    upload.single("resume")(req, res, (err) => {
      if (err) {
        res.status(400).json({
          error:
            err.code === "LIMIT_FILE_SIZE"
              ? `Resume exceeds maximum file size of ${Math.round(
                  config.resumeMaxSizeBytes / (1024 * 1024)
                )} MB.`
              : err.message || "File upload error.",
        });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A PDF resume file is required to apply." });
      return;
    }

    const bufferCheck = validateUploadBuffer({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    if (!bufferCheck.valid) {
      res.status(400).json({
        code: bufferCheck.code,
        error: bufferCheck.message,
      });
      return;
    }

    const jobPrecheck = await db.jobs.findById(req.params.jobId);
    if (!jobPrecheck) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }
    if (jobPrecheck.status !== "open") {
      res.status(400).json({
        error: `This job is currently ${jobPrecheck.status} and is not accepting applications.`,
      });
      return;
    }

    const company = await db.companies.findById(jobPrecheck.companyId);
    if (!company || company.status === "suspended") {
      res.status(403).json({ error: "This company is not currently accepting applications." });
      return;
    }

    // Optional trusted referral handling (non-blocking if user selects continueWithoutReferral)
    const rawReferralCode = String(req.body?.referralCode || "").trim().toUpperCase();
    const continueWithoutReferral =
      String(req.body?.continueWithoutReferral || "false").toLowerCase() === "true";

    let validatedReferral: { id: string; code: string } | null = null;
    if (rawReferralCode && !continueWithoutReferral) {
      const refToken = await db.referrals.findOne(
        (r) =>
          r.code.toUpperCase() === rawReferralCode &&
          r.companyId === jobPrecheck.companyId &&
          (!r.jobId || r.jobId === jobPrecheck.id)
      );

      const isExpired =
        refToken?.expiresAt && new Date(refToken.expiresAt).getTime() < Date.now();
      const isExhausted =
        refToken?.maxUses !== null &&
        refToken?.maxUses !== undefined &&
        refToken.usedCount >= refToken.maxUses;

      if (!refToken || !refToken.active || isExpired || isExhausted) {
        res.status(422).json({
          code: "INVALID_REFERRAL",
          error:
            "This referral code is invalid, expired, or belongs to a different job. You can continue applying without a referral.",
          canContinueWithoutReferral: true,
        });
        return;
      }
      validatedReferral = { id: refToken.id, code: refToken.code };
    }

    const portfolio = await db.portfolios.findOne((p) => p.userId === req.user!.id);
    const coverLetter =
      typeof req.body?.coverLetter === "string"
        ? req.body.coverLetter.trim().slice(0, 3000)
        : undefined;

    const appId = `app_${crypto.randomUUID().slice(0, 12)}`;
    const resumeFile = createResumeFileRecord({
      companyId: jobPrecheck.companyId,
      jobId: jobPrecheck.id,
      candidateId: req.user!.id,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
    resumeFile.applicationId = appId;

    const atomicResult = await db.atomicCreateApplication({
      jobId: jobPrecheck.id,
      candidateId: req.user!.id,
      createRecord: async () => {
        const now = new Date().toISOString();
        const appRecord: ApplicationRecord = {
          id: appId,
          jobId: jobPrecheck.id,
          companyId: jobPrecheck.companyId,
          candidateId: req.user!.id,
          candidateName: portfolio?.displayName || req.user!.name,
          candidateEmail: req.user!.email,
          portfolioSlug: portfolio?.visibility === "public" ? portfolio.slug : null,
          coverLetter: coverLetter || undefined,
          resumeFileId: resumeFile.id,
          resumeFilename: resumeFile.originalFilename,
          resumeProcessingStatus: "uploaded",
          evaluationStatus: "pending",
          screeningResult: "not_determined",
          weightedScore: null,
          isReferral: Boolean(validatedReferral),
          referralCodeUsed: validatedReferral?.code ?? null,
          recruiterDecision: "pending",
          applicationStatus: "submitted",
          reviewFlags: [],
          submittedAt: now,
          updatedAt: now,
        };
        return appRecord;
      },
    });

    if (!atomicResult.ok) {
      if (atomicResult.reason === "duplicate") {
        res.status(409).json({
          code: "DUPLICATE_APPLICATION",
          error: "You have already applied to this job.",
          existingApplicationId: atomicResult.existingApplication?.id,
        });
        return;
      }
      if (atomicResult.reason === "cap_reached") {
        res.status(409).json({
          code: "JOB_CAP_REACHED",
          error:
            "This job has reached the Hatchling maximum of 20 applications and is no longer accepting submissions.",
        });
        return;
      }
      res.status(400).json({ error: "Unable to submit application for this job." });
      return;
    }

    await db.resumeFiles.insert(resumeFile);

    if (validatedReferral) {
      const refDoc = await db.referrals.findById(validatedReferral.id);
      if (refDoc) {
        await db.referrals.updateById(refDoc.id, { usedCount: refDoc.usedCount + 1 });
      }
    }

    await writeAuditLog({
      actorId: req.user!.id,
      actorRole: "student",
      action: "application_submitted",
      targetType: "application",
      targetId: atomicResult.application.id,
      companyId: atomicResult.application.companyId,
      newState: {
        jobId: atomicResult.application.jobId,
        isReferral: atomicResult.application.isReferral,
      },
      requestId: req.requestId,
    });

    const processed = await processResumeAndEvaluateApplication({
      application: atomicResult.application,
      resumeFile,
      pdfBuffer: file.buffer,
      requestId: req.requestId,
    });

    // Return candidate-safe summary (never expose recruiter-only breakdown/scores)
    res.status(201).json({
      application: sanitizeApplicationForCandidate(processed.application),
      resumeProcessingStatus: processed.resumeFile.processingStatus,
      failureMessageSafe: processed.resumeFile.failureMessageSafe,
    });
  }
);

function sanitizeApplicationForCandidate(app: ApplicationRecord) {
  return {
    id: app.id,
    jobId: app.jobId,
    companyId: app.companyId,
    candidateId: app.candidateId,
    candidateName: app.candidateName,
    resumeFileId: app.resumeFileId,
    resumeFilename: app.resumeFilename,
    resumeProcessingStatus: app.resumeProcessingStatus,
    evaluationStatus: app.evaluationStatus,
    // Candidate never sees recruiter-facing weightedScore, category breakdown, internal notes, or hidden rank
    applicationStatus: app.applicationStatus,
    recruiterDecision:
      app.recruiterDecision === "shortlisted" ||
      app.recruiterDecision === "interview_invited" ||
      app.recruiterDecision === "selected" ||
      app.recruiterDecision === "not_selected" ||
      app.recruiterDecision === "on_hold"
        ? app.recruiterDecision
        : "pending",
    isReferral: app.isReferral,
    interviewId: app.interviewId ?? null,
    interviewStatus: app.interviewStatus ?? null,
    submittedAt: app.submittedAt,
    updatedAt: app.updatedAt,
  };
}

// 2. Student applications list & detail
applicationsRouter.get(
  "/student/applications",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    const apps = await db.applications.findMany((a) => a.candidateId === req.user!.id);
    apps.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    const enriched = await Promise.all(
      apps.map(async (app) => {
        const job = await db.jobs.findById(app.jobId);
        const interview = app.interviewId
          ? await db.interviews.findById(app.interviewId)
          : null;
        return {
          ...sanitizeApplicationForCandidate(app),
          jobTitle: job?.title ?? "Job Listing",
          companyName: job?.companyName ?? "Company",
          companyVerificationStatus: job?.companyVerificationStatus ?? "not_verified",
          location: job?.location ?? "",
          workMode: job?.workMode ?? "remote",
          interviewToken:
            interview && (interview.status === "invited" || interview.status === "in_progress")
              ? interview.token
              : null,
          interviewDeadlineAt: interview?.deadlineAt ?? null,
        };
      })
    );

    res.json({ applications: enriched });
  }
);

applicationsRouter.get(
  "/student/applications/:applicationId",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    const app = await db.applications.findById(req.params.applicationId);
    if (!app) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    if (!assertCandidateAccess(req.user!, app.candidateId)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const job = await db.jobs.findById(app.jobId);
    const resumeFile = await db.resumeFiles.findById(app.resumeFileId);
    const interview = app.interviewId
      ? await db.interviews.findById(app.interviewId)
      : null;

    res.json({
      application: sanitizeApplicationForCandidate(app),
      job: job
        ? {
            id: job.id,
            title: job.title,
            companyName: job.companyName,
            companyVerificationStatus: job.companyVerificationStatus,
            location: job.location,
            workMode: job.workMode,
          }
        : null,
      resumeStatusNote: resumeFile?.failureMessageSafe ?? null,
      interviewInvitation:
        interview && interview.status !== "revoked"
          ? {
              id: interview.id,
              status: interview.status,
              token:
                interview.status === "invited" || interview.status === "in_progress"
                  ? interview.token
                  : null,
              durationMinutes: interview.durationMinutes,
              deadlineAt: interview.deadlineAt,
            }
          : null,
    });
  }
);

// 3. Recruiter Ranked Applicants Endpoint (AUTHORITATIVE REFERRAL-FIRST ORDER)
applicationsRouter.get(
  "/jobs/:jobId/applications",
  requireAuth,
  requireRole("recruiter", "admin"),
  async (req, res) => {
    const job = await db.jobs.findById(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }
    const access = await assertCompanyAccess(req.user!, job.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    const screening = String(req.query.screening || "qualified");
    const sortMode = String(req.query.sort || "referral_then_score");
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const minScore = req.query.minScore !== undefined ? Number(req.query.minScore) : null;
    const maxScore = req.query.maxScore !== undefined ? Number(req.query.maxScore) : null;
    const referralFilter = String(req.query.referral || "all");

    const allApps = await db.applications.findMany((a) => a.jobId === job.id);

    // Filter helpers preserving referral-first order for qualified view
    const applyOptionalFilters = (list: ApplicationRecord[]) =>
      list.filter((a) => {
        if (referralFilter === "referred" && !a.isReferral) return false;
        if (referralFilter === "non_referred" && a.isReferral) return false;
        if (minScore !== null && Number.isFinite(minScore)) {
          if (a.weightedScore === null || a.weightedScore < minScore) return false;
        }
        if (maxScore !== null && Number.isFinite(maxScore)) {
          if (a.weightedScore === null || a.weightedScore > maxScore) return false;
        }
        return true;
      });

    let ordered: ApplicationRecord[] = [];
    if (screening === "qualified") {
      const ranked = rankApplicationRecords(applyOptionalFilters(allApps));
      ordered = ranked.combined;
      if (sortMode === "newest_alternate") {
        ordered = [...ordered].sort(
          (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );
      }
    } else if (screening === "not_qualified") {
      ordered = applyOptionalFilters(
        allApps.filter(
          (a) =>
            a.screeningResult === "not_qualified" &&
            (a.evaluationStatus === "completed" || a.evaluationStatus === "needs_review")
        )
      ).sort((a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0));
    } else if (screening === "needs_review") {
      ordered = applyOptionalFilters(
        allApps.filter((a) => a.evaluationStatus === "needs_review")
      );
    } else if (screening === "failed") {
      ordered = applyOptionalFilters(
        allApps.filter(
          (a) =>
            a.evaluationStatus === "failed" ||
            a.resumeProcessingStatus === "extraction_failed"
        )
      );
    } else if (screening === "processing") {
      ordered = applyOptionalFilters(
        allApps.filter(
          (a) =>
            a.evaluationStatus === "pending" || a.evaluationStatus === "processing"
        )
      );
    } else if (screening === "shortlisted") {
      ordered = rankApplicationRecords(
        applyOptionalFilters(
          allApps.filter((a) => a.recruiterDecision === "shortlisted")
        )
      ).combined;
    } else if (screening === "interview") {
      ordered = applyOptionalFilters(
        allApps.filter(
          (a) =>
            a.recruiterDecision === "interview_invited" || Boolean(a.interviewId)
        )
      );
    } else {
      ordered = applyOptionalFilters(allApps);
    }

    const paged = paginateCombinedList(ordered, page, limit);
    const tieGroups = detectExactTies(allApps).map((t) => ({
      tieGroupKey: t.tieGroupKey,
      weightedScore: t.weightedScore,
      count: t.applications.length,
      candidateNames: t.applications.map((a) => a.candidateName),
    }));

    const counts = {
      all: allApps.length,
      qualified: allApps.filter((a) => a.screeningResult === "qualified").length,
      qualifiedReferrals: allApps.filter(
        (a) => a.screeningResult === "qualified" && a.isReferral
      ).length,
      notQualified: allApps.filter((a) => a.screeningResult === "not_qualified").length,
      needsReview: allApps.filter((a) => a.evaluationStatus === "needs_review").length,
      failed: allApps.filter(
        (a) =>
          a.evaluationStatus === "failed" ||
          a.resumeProcessingStatus === "extraction_failed"
      ).length,
      processing: allApps.filter(
        (a) => a.evaluationStatus === "pending" || a.evaluationStatus === "processing"
      ).length,
      shortlisted: allApps.filter((a) => a.recruiterDecision === "shortlisted").length,
      interview: allApps.filter(
        (a) => a.recruiterDecision === "interview_invited" || Boolean(a.interviewId)
      ).length,
    };

    res.json({
      jobId: job.id,
      jobTitle: job.title,
      applicationCap: job.applicationCap,
      applicationCount: job.applicationCount,
      screeningThreshold: RESUME_SCREENING_CONFIG.qualificationThreshold,
      rankingRule:
        sortMode === "newest_alternate"
          ? "newest_alternate"
          : "referrals_then_non_referrals",
      counts,
      tieGroups,
      items: paged.items,
      total: paged.total,
      page: paged.page,
      limit: paged.limit,
      totalPages: paged.totalPages,
    });
  }
);

// 4. Retrieve candidate evaluation (Recruiter/Admin full evidence; Candidate denied recruiter scores)
applicationsRouter.get(
  "/applications/:applicationId/resume-evaluation",
  requireAuth,
  async (req, res) => {
    const app = await db.applications.findById(req.params.applicationId);
    if (!app) {
      res.status(404).json({ error: "Application not found." });
      return;
    }

    if (req.user!.role === "student") {
      if (!assertCandidateAccess(req.user!, app.candidateId)) {
        res.status(403).json({ error: "Access denied." });
        return;
      }
      // Candidate privacy boundary: never return weightedScore, categoryScores, evidence, or internal notes
      res.json({
        application: sanitizeApplicationForCandidate(app),
        evaluation: {
          evaluationStatus: app.evaluationStatus,
          resumeProcessingStatus: app.resumeProcessingStatus,
          notice:
            "Detailed ATS rubric scores and recruiter evaluation evidence are visible only to the hiring team.",
        },
      });
      return;
    }

    const access = await assertCompanyAccess(req.user!, app.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    const evals = await db.resumeEvaluations.findMany((e) => e.applicationId === app.id);
    evals.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const activeEval = evals[0] ?? null;
    const job = await db.jobs.findById(app.jobId);
    const profile = activeEval
      ? await db.jobEvaluationProfiles.findById(activeEval.jobEvaluationProfileId)
      : null;
    const resumeFile = await db.resumeFiles.findById(app.resumeFileId);

    res.json({
      application: app,
      evaluation: activeEval,
      evaluationHistory: evals,
      job,
      jobEvaluationProfile: profile,
      resumeFile: resumeFile
        ? {
            id: resumeFile.id,
            originalFilename: resumeFile.originalFilename,
            sizeBytes: resumeFile.sizeBytes,
            pageCount: resumeFile.pageCount,
            processingStatus: resumeFile.processingStatus,
            failureMessageSafe: resumeFile.failureMessageSafe,
            createdAt: resumeFile.createdAt,
          }
        : null,
    });
  }
);

// 5. Retry failed resume evaluation
applicationsRouter.post(
  "/applications/:applicationId/retry-evaluation",
  requireAuth,
  requireRole("recruiter", "admin"),
  async (req, res) => {
    const app = await db.applications.findById(req.params.applicationId);
    if (!app) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    const access = await assertCompanyAccess(req.user!, app.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    const resumeFile = await db.resumeFiles.findById(app.resumeFileId);
    if (!resumeFile) {
      res.status(404).json({ error: "Resume file record not found." });
      return;
    }

    const result = await processResumeAndEvaluateApplication({
      application: app,
      resumeFile,
      requestId: req.requestId,
    });

    res.json({
      application: result.application,
      evaluation: result.evaluation,
    });
  }
);

// 6. Resolve Needs-Review Flag
applicationsRouter.post(
  "/applications/:applicationId/resolve-review",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const schema = z.object({ note: z.string().trim().min(5).max(1000) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "A human review resolution note (min 5 chars) is required." });
      return;
    }

    const app = await db.applications.findById(req.params.applicationId);
    if (!app) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    const access = await assertCompanyAccess(req.user!, app.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    const evals = await db.resumeEvaluations.findMany((e) => e.applicationId === app.id);
    evals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (evals[0]) {
      await db.resumeEvaluations.updateById(evals[0].id, {
        evaluationStatus: "completed",
        reviewResolved: true,
        reviewResolutionNote: parsed.data.note,
        reviewResolvedBy: req.user!.id,
        reviewResolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const updatedApp = await db.applications.updateById(app.id, {
      evaluationStatus: "completed",
      applicationStatus: "screening_completed",
      recruiterNotes: app.recruiterNotes
        ? `${app.recruiterNotes}\n[Review Resolved]: ${parsed.data.note}`
        : `[Review Resolved]: ${parsed.data.note}`,
      updatedAt: new Date().toISOString(),
    });

    await writeAuditLog({
      actorId: req.user!.id,
      actorRole: "recruiter",
      action: "screening_review_resolved",
      targetType: "application",
      targetId: app.id,
      companyId: app.companyId,
      reason: parsed.data.note,
      requestId: req.requestId,
    });

    res.json({ application: updatedApp });
  }
);

// 7. Recruiter Decision (Shortlist, On Hold, Selected, Not Selected)
applicationsRouter.post(
  "/applications/:applicationId/decision",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const schema = z
      .object({
        decision: z.enum(["shortlisted", "on_hold", "selected", "not_selected"]),
        reason: z.string().trim().max(1000).optional(),
        notes: z.string().trim().max(2000).optional(),
      })
      .strict();

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid recruiter decision payload." });
      return;
    }

    const app = await db.applications.findById(req.params.applicationId);
    if (!app) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    const access = await assertCompanyAccess(req.user!, app.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    if (parsed.data.decision === "not_selected" && (!parsed.data.reason || parsed.data.reason.length < 3)) {
      res.status(400).json({ error: "A job-related reason is required when marking Not Proceeding." });
      return;
    }

    if (parsed.data.decision === "shortlisted" && app.screeningResult !== "qualified") {
      res.status(400).json({
        error: "Only qualified candidates (>= 60.00 ATS score) can be shortlisted.",
      });
      return;
    }

    const statusMap = {
      shortlisted: "shortlisted",
      on_hold: "on_hold",
      selected: "selected",
      not_selected: "not_selected",
    } as const;

    const prevDecision = app.recruiterDecision;
    const updated = (await db.applications.updateById(app.id, {
      recruiterDecision: parsed.data.decision,
      applicationStatus: statusMap[parsed.data.decision],
      decisionReason: parsed.data.reason ?? app.decisionReason ?? null,
      recruiterNotes:
        parsed.data.notes !== undefined ? parsed.data.notes : app.recruiterNotes,
      updatedAt: new Date().toISOString(),
    }))!;

    const job = await db.jobs.findById(app.jobId);
    if (parsed.data.decision === "shortlisted") {
      await sendPlatformEmail({
        toEmail: app.candidateEmail,
        toName: app.candidateName,
        subject: `Shortlisted for ${job?.title || "role"} — HireZilla`,
        bodyText: `Hi ${app.candidateName},\n\nGreat news! Your application for ${
          job?.title || "the position"
        } at ${job?.companyName || "the company"} has been shortlisted by the hiring team.\n\nNext updates will appear in your HireZilla Applications dashboard.`,
        templateType: "shortlist",
        relatedApplicationId: app.id,
      });
    } else if (parsed.data.decision === "not_selected") {
      await sendPlatformEmail({
        toEmail: app.candidateEmail,
        toName: app.candidateName,
        subject: `Application update for ${job?.title || "role"} — HireZilla`,
        bodyText: `Hi ${app.candidateName},\n\nThank you for applying to ${
          job?.title || "the role"
        } at ${
          job?.companyName || "the company"
        }. After careful review, the hiring team is moving forward with other applicants at this stage.`,
        templateType: "decision_update",
        relatedApplicationId: app.id,
      });
    }

    await writeAuditLog({
      actorId: req.user!.id,
      actorRole: "recruiter",
      action: "recruiter_decision_recorded",
      targetType: "application",
      targetId: app.id,
      companyId: app.companyId,
      reason: parsed.data.reason ?? null,
      previousState: { recruiterDecision: prevDecision },
      newState: { recruiterDecision: parsed.data.decision },
      requestId: req.requestId,
    });

    res.json({ application: updated });
  }
);

// 8. Exact Tie Review Endpoints (§15 of UI Spec + §9.1 of ATS Policy)
applicationsRouter.get(
  "/jobs/:jobId/ties/:tieGroupKey",
  requireAuth,
  requireRole("recruiter", "admin"),
  async (req, res) => {
    const job = await db.jobs.findById(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }
    const access = await assertCompanyAccess(req.user!, job.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    const apps = await db.applications.findMany((a) => a.jobId === job.id);
    const ties = detectExactTies(apps);
    const group = ties.find((t) => t.tieGroupKey === req.params.tieGroupKey);
    if (!group) {
      res.status(404).json({ error: "No active tie group found for this score." });
      return;
    }

    const candidatesWithEvals = await Promise.all(
      group.applications.map(async (app) => {
        const evals = await db.resumeEvaluations.findMany((e) => e.applicationId === app.id);
        evals.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return {
          application: app,
          evaluation: evals[0] ?? null,
        };
      })
    );

    const priorResolutions = await db.tieResolutions.findMany(
      (r) => r.jobId === job.id && r.weightedScore === group.weightedScore
    );

    res.json({
      job,
      tieGroupKey: group.tieGroupKey,
      weightedScore: group.weightedScore,
      candidates: candidatesWithEvals,
      reasonCodes: TIE_REASON_CODES,
      priorResolutions,
    });
  }
);

applicationsRouter.post(
  "/jobs/:jobId/ties/:tieGroupKey/resolve",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const validCodes = TIE_REASON_CODES.map((r) => r.code) as [string, ...string[]];
    const schema = z
      .object({
        outcome: z.enum(["selected_one", "progress_both", "not_proceeding_either"]),
        selectedApplicationIds: z.array(z.string()).default([]),
        reasonCode: z.enum(validCodes),
        note: z.string().trim().max(1000).default(""),
      })
      .strict();

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid tie-review payload." });
      return;
    }

    if (
      parsed.data.reasonCode === "other_job_related_reason" &&
      parsed.data.note.trim().length < 5
    ) {
      res.status(400).json({
        error: "A job-related text note is required when selecting 'Other job-related reason'.",
      });
      return;
    }

    if (
      PROTECTED_ATTRIBUTE_PATTERNS.some((rx) => rx.test(parsed.data.note)) ||
      /\breferral\b/i.test(parsed.data.note)
    ) {
      res.status(400).json({
        error:
          "Tie decisions must be based strictly on job-related evidence—never protected attributes or referral status alone.",
      });
      return;
    }

    const job = await db.jobs.findById(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }
    const access = await assertCompanyAccess(req.user!, job.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    const apps = await db.applications.findMany((a) => a.jobId === job.id);
    const group = detectExactTies(apps).find(
      (t) => t.tieGroupKey === req.params.tieGroupKey
    );
    if (!group) {
      res.status(404).json({ error: "Exact tie group no longer exists for this job." });
      return;
    }

    const groupAppIds = new Set(group.applications.map((a) => a.id));
    if (
      parsed.data.outcome === "selected_one" &&
      (parsed.data.selectedApplicationIds.length !== 1 ||
        !groupAppIds.has(parsed.data.selectedApplicationIds[0]))
    ) {
      res.status(400).json({ error: "Select exactly one tied candidate to progress." });
      return;
    }

    const resolution: TieResolutionRecord = {
      id: `tie_${crypto.randomUUID().slice(0, 12)}`,
      jobId: job.id,
      companyId: job.companyId,
      weightedScore: group.weightedScore,
      candidateApplicationIds: group.applications.map((a) => a.id),
      outcome: parsed.data.outcome,
      selectedApplicationIds:
        parsed.data.outcome === "progress_both"
          ? group.applications.map((a) => a.id)
          : parsed.data.outcome === "selected_one"
            ? parsed.data.selectedApplicationIds
            : [],
      reasonCode: parsed.data.reasonCode as TieResolutionRecord["reasonCode"],
      note: parsed.data.note,
      recruiterId: req.user!.id,
      createdAt: new Date().toISOString(),
    };
    await db.tieResolutions.insert(resolution);

    for (const app of group.applications) {
      if (parsed.data.outcome === "not_proceeding_either") {
        await db.applications.updateById(app.id, {
          recruiterDecision: "not_selected",
          applicationStatus: "not_selected",
          decisionReason: `Tie review (${parsed.data.reasonCode}): ${parsed.data.note}`,
          updatedAt: new Date().toISOString(),
        });
      } else if (
        parsed.data.outcome === "progress_both" ||
        parsed.data.selectedApplicationIds.includes(app.id)
      ) {
        await db.applications.updateById(app.id, {
          recruiterDecision: "shortlisted",
          applicationStatus: "shortlisted",
          decisionReason: `Tie review (${parsed.data.reasonCode})`,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.applications.updateById(app.id, {
          recruiterDecision: "on_hold",
          applicationStatus: "on_hold",
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await writeAuditLog({
      actorId: req.user!.id,
      actorRole: "recruiter",
      action: "tie_review_resolved",
      targetType: "job",
      targetId: job.id,
      companyId: job.companyId,
      reason: `${parsed.data.reasonCode}: ${parsed.data.note}`,
      newState: resolution,
      requestId: req.requestId,
    });

    res.json({ resolution });
  }
);

// 9. Private Signed Resume Download Endpoints (never expose permanent public URLs)
applicationsRouter.get(
  "/resumes/:fileId/signed-url",
  requireAuth,
  async (req, res) => {
    const file = await db.resumeFiles.findById(req.params.fileId);
    if (!file) {
      res.status(404).json({ error: "Resume file not found." });
      return;
    }

    if (req.user!.role === "student") {
      if (!assertCandidateAccess(req.user!, file.candidateId)) {
        res.status(403).json({ error: "Cannot access another candidate's resume." });
        return;
      }
    } else {
      const access = await assertCompanyAccess(req.user!, file.companyId);
      if (!access.allowed) {
        res.status(access.statusCode).json({ error: access.message });
        return;
      }
    }

    const signed = createSignedDownloadToken({
      fileId: file.id,
      userId: req.user!.id,
    });

    res.json({
      downloadUrl: `/api/resumes/${file.id}/download?token=${encodeURIComponent(signed.token)}`,
      expiresAt: signed.expiresAt,
      filename: file.originalFilename,
    });
  }
);

applicationsRouter.get("/resumes/:fileId/download", async (req, res) => {
  const token = String(req.query.token || "");
  if (!token) {
    res.status(401).json({ error: "Signed download token required." });
    return;
  }

  const verified = verifySignedDownloadToken(token, req.params.fileId);
  if (!verified.valid) {
    res.status(403).json({ error: verified.reason });
    return;
  }

  const file = await db.resumeFiles.findById(req.params.fileId);
  if (!file) {
    res.status(404).json({ error: "Resume file not found." });
    return;
  }

  const buffer = readPrivateResumeFile(file.storageKey);
  if (!buffer) {
    res.status(404).json({ error: "Stored resume file is unavailable." });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`
  );
  res.send(buffer);
});
