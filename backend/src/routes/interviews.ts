import crypto from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config";
import { db } from "../db/database";
import {
  assertCompanyAccess,
  requireAuth,
  requireRole,
} from "../middleware/auth";
import {
  evaluateInterviewWithAI,
  generateInterviewQuestionsWithAI,
} from "../services/ai";
import { writeAuditLog } from "../services/audit";
import { sendPlatformEmail } from "../services/email";
import type {
  InterviewAnswer,
  InterviewQuestionSet,
  InterviewReport,
  InterviewSession,
} from "../../../shared/types";

export const interviewsRouter = express.Router();

const interviewSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: () => config.isTest,
  standardHeaders: true,
  legacyHeaders: false,
});

// 1. Recruiter Interview Question Set Setup
interviewsRouter.get(
  "/recruiter/jobs/:jobId/interview-setup",
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

    const sets = await db.interviewQuestionSets.findMany((s) => s.jobId === job.id);
    sets.sort((a, b) => b.version - a.version);
    res.json({ job, questionSet: sets[0] ?? null, history: sets });
  }
);

interviewsRouter.post(
  "/recruiter/jobs/:jobId/interview-setup/generate",
  requireAuth,
  requireRole("recruiter"),
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

    const count = Number(req.body?.count || 5);
    const profile = job.activeEvaluationProfileId
      ? await db.jobEvaluationProfiles.findById(job.activeEvaluationProfileId)
      : null;

    try {
      const questions = await generateInterviewQuestionsWithAI({ job, profile, count });
      res.json({ questions });
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error
            ? err.message
            : "AI question generation failed. You can author questions manually below.",
        allowManualAuthoring: true,
      });
    }
  }
);

interviewsRouter.put(
  "/recruiter/jobs/:jobId/interview-setup",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const schema = z
      .object({
        status: z.enum(["draft", "published"]),
        durationMinutes: z
          .number()
          .int()
          .min(10)
          .max(config.interviewMaxDurationMinutes),
        questions: z
          .array(
            z.object({
              id: z.string().min(1),
              prompt: z.string().trim().min(10),
              competency: z.string().trim().min(2),
              rubricSignals: z.array(z.string().trim().min(1)).min(1),
              expectedTimeMinutes: z.number().int().min(2).max(45).optional(),
            })
          )
          .min(config.interviewMinQuestions)
          .max(config.interviewMaxQuestions),
      })
      .strict();

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
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

    const existing = await db.interviewQuestionSets.findMany((s) => s.jobId === job.id);
    const nextVersion =
      existing.reduce((m, s) => Math.max(m, s.version), 0) + 1;
    const now = new Date().toISOString();

    const set: InterviewQuestionSet = {
      id: `qset_${crypto.randomUUID().slice(0, 12)}`,
      jobId: job.id,
      companyId: job.companyId,
      version: nextVersion,
      status: parsed.data.status,
      durationMinutes: parsed.data.durationMinutes,
      questions: parsed.data.questions,
      createdBy: req.user!.id,
      createdAt: now,
      updatedAt: now,
    };
    await db.interviewQuestionSets.insert(set);

    await writeAuditLog({
      actorId: req.user!.id,
      actorRole: "recruiter",
      action:
        parsed.data.status === "published"
          ? "interview_questions_published"
          : "interview_questions_saved",
      targetType: "job",
      targetId: job.id,
      companyId: job.companyId,
      newState: { questionSetId: set.id, version: set.version },
      requestId: req.requestId,
    });

    res.json({ questionSet: set });
  }
);

// 2. Invitation Management
interviewsRouter.get(
  "/recruiter/jobs/:jobId/interviews",
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

    const sessions = await db.interviews.findMany((i) => i.jobId === job.id);
    sessions.sort((a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime());

    const apps = await db.applications.findMany(
      (a) =>
        a.jobId === job.id &&
        a.screeningResult === "qualified" &&
        (a.recruiterDecision === "shortlisted" ||
          a.recruiterDecision === "interview_invited")
    );

    const publishedSets = await db.interviewQuestionSets.findMany(
      (s) => s.jobId === job.id && s.status === "published"
    );
    publishedSets.sort((a, b) => b.version - a.version);

    res.json({
      job,
      sessions,
      eligibleShortlisted: apps,
      hasPublishedQuestionSet: publishedSets.length > 0,
      latestQuestionSet: publishedSets[0] ?? null,
    });
  }
);

interviewsRouter.post(
  "/recruiter/jobs/:jobId/interviews/invite",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const schema = z
      .object({
        applicationIds: z.array(z.string().min(1)).min(1),
        deadlineAt: z.string().min(10),
        durationMinutes: z
          .number()
          .int()
          .min(10)
          .max(config.interviewMaxDurationMinutes)
          .optional(),
        simulateEmailFailure: z.boolean().optional(),
      })
      .strict();

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Select at least one shortlisted candidate and a valid future deadline." });
      return;
    }

    const deadlineMs = new Date(parsed.data.deadlineAt).getTime();
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      res.status(400).json({ error: "Completion deadline must be in the future." });
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

    const company = await db.companies.findById(job.companyId);
    if (!company || company.packageCode !== "HATCHLING_FREE") {
      res.status(403).json({ error: "Active Hatchling entitlement required." });
      return;
    }

    const publishedSets = await db.interviewQuestionSets.findMany(
      (s) => s.jobId === job.id && s.status === "published"
    );
    publishedSets.sort((a, b) => b.version - a.version);
    const activeSet = publishedSets[0];
    if (!activeSet) {
      res.status(400).json({
        error: "Publish an interview question set before inviting candidates.",
      });
      return;
    }

    const createdSessions: InterviewSession[] = [];
    for (const appId of parsed.data.applicationIds) {
      const app = await db.applications.findById(appId);
      if (!app || app.jobId !== job.id || app.screeningResult !== "qualified") {
        continue;
      }

      const token = `HZ-INT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const now = new Date().toISOString();
      const duration = parsed.data.durationMinutes ?? activeSet.durationMinutes;

      const session: InterviewSession = {
        id: `int_${crypto.randomUUID().slice(0, 12)}`,
        applicationId: app.id,
        jobId: job.id,
        companyId: job.companyId,
        candidateId: app.candidateId,
        candidateName: app.candidateName,
        questionSetId: activeSet.id,
        questionSetVersion: activeSet.version,
        questions: activeSet.questions,
        token,
        status: "invited",
        durationMinutes: duration,
        deadlineAt: new Date(deadlineMs).toISOString(),
        invitedAt: now,
        startedAt: null,
        submittedAt: null,
        answers: [],
        emailDeliveryStatus: "pending",
        auditTrail: [
          {
            timestamp: now,
            message: `Invited by recruiter with ${duration}-minute assessment limit.`,
          },
        ],
      };

      const email = await sendPlatformEmail({
        toEmail: app.candidateEmail,
        toName: app.candidateName,
        subject: `AI Text Interview Invitation: ${job.title} at ${job.companyName} — HireZilla`,
        bodyText: `Hi ${app.candidateName},\n\nYou have been invited to complete a written AI-assisted technical interview for ${job.title} at ${job.companyName}.\n\nQuestions: ${activeSet.questions.length}\nTime limit once started: ${duration} minutes\nComplete before: ${session.deadlineAt}\nInterview Link: ${config.frontendUrl}/interview/${token}`,
        templateType: "interview_invite",
        relatedApplicationId: app.id,
        relatedInterviewId: session.id,
        simulateFailure: parsed.data.simulateEmailFailure,
      });

      session.emailDeliveryStatus = email.status === "failed" ? "failed" : "sent";
      await db.interviews.insert(session);
      await db.applications.updateById(app.id, {
        recruiterDecision: "interview_invited",
        applicationStatus: "interview_invited",
        interviewId: session.id,
        interviewStatus: session.status,
        updatedAt: now,
      });

      createdSessions.push(session);
    }

    res.status(201).json({ invitations: createdSessions });
  }
);

interviewsRouter.post(
  "/recruiter/interviews/:interviewId/resend",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const session = await db.interviews.findById(req.params.interviewId);
    if (!session) {
      res.status(404).json({ error: "Interview session not found." });
      return;
    }
    const access = await assertCompanyAccess(req.user!, session.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    if (session.status !== "invited" && session.status !== "in_progress") {
      res.status(400).json({ error: "Cannot resend a completed or revoked interview." });
      return;
    }

    const app = await db.applications.findById(session.applicationId);
    const job = await db.jobs.findById(session.jobId);
    if (!app || !job) {
      res.status(404).json({ error: "Application or job missing." });
      return;
    }

    const email = await sendPlatformEmail({
      toEmail: app.candidateEmail,
      toName: app.candidateName,
      subject: `Reminder: AI Text Interview Invitation (${job.title}) — HireZilla`,
      bodyText: `Hi ${app.candidateName},\n\nHere is your interview link for ${job.title} at ${job.companyName}:\n${config.frontendUrl}/interview/${session.token}`,
      templateType: "interview_invite",
      relatedApplicationId: app.id,
      relatedInterviewId: session.id,
    });

    const updated = await db.interviews.updateById(session.id, {
      emailDeliveryStatus: email.status === "failed" ? "failed" : "sent",
      auditTrail: [
        ...session.auditTrail,
        { timestamp: new Date().toISOString(), message: "Invitation email resent." },
      ],
    });

    res.json({ session: updated });
  }
);

interviewsRouter.post(
  "/recruiter/interviews/:interviewId/revoke",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const session = await db.interviews.findById(req.params.interviewId);
    if (!session) {
      res.status(404).json({ error: "Interview session not found." });
      return;
    }
    const access = await assertCompanyAccess(req.user!, session.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    if (session.status === "submitted" || session.status === "report_ready") {
      res.status(400).json({ error: "Cannot revoke a submitted interview." });
      return;
    }

    const now = new Date().toISOString();
    const updated = await db.interviews.updateById(session.id, {
      status: "revoked",
      auditTrail: [
        ...session.auditTrail,
        { timestamp: now, message: "Invitation revoked by recruiter." },
      ],
    });
    await db.applications.updateById(session.applicationId, {
      interviewStatus: "revoked",
      updatedAt: now,
    });

    res.json({ session: updated });
  }
);

// 3. Candidate Token Interview Runner
function computeRemainingSeconds(session: InterviewSession): number {
  const deadlineRemaining = Math.floor(
    (new Date(session.deadlineAt).getTime() - Date.now()) / 1000
  );
  if (!session.startedAt) {
    return Math.max(0, Math.min(deadlineRemaining, session.durationMinutes * 60));
  }
  const durationEnd =
    new Date(session.startedAt).getTime() + session.durationMinutes * 60 * 1000;
  const durationRemaining = Math.floor((durationEnd - Date.now()) / 1000);
  return Math.max(0, Math.min(deadlineRemaining, durationRemaining));
}

interviewsRouter.get("/interviews/token/:token", async (req, res) => {
  const session = await db.interviews.findOne((i) => i.token === req.params.token);
  if (!session) {
    res.status(404).json({ error: "Interview link is invalid or does not exist." });
    return;
  }

  // If authenticated as another student, block cross-candidate access
  if (
    req.user &&
    req.user.role === "student" &&
    req.user.id !== session.candidateId
  ) {
    res.status(403).json({ error: "This interview invitation belongs to another candidate." });
    return;
  }

  const job = await db.jobs.findById(session.jobId);
  const remainingSeconds = computeRemainingSeconds(session);

  if (
    (session.status === "invited" || session.status === "in_progress") &&
    new Date(session.deadlineAt).getTime() < Date.now()
  ) {
    await db.interviews.updateById(session.id, { status: "expired" });
    session.status = "expired";
  }

  res.json({
    session: {
      id: session.id,
      status: session.status,
      candidateName: session.candidateName,
      durationMinutes: session.durationMinutes,
      deadlineAt: session.deadlineAt,
      startedAt: session.startedAt,
      submittedAt: session.submittedAt,
      questions: session.questions,
      answers: session.answers,
      remainingSeconds,
      token: session.token,
    },
    job: job
      ? {
          id: job.id,
          title: job.title,
          companyName: job.companyName,
          companyVerificationStatus: job.companyVerificationStatus,
        }
      : null,
  });
});

interviewsRouter.post(
  "/interviews/token/:token/start",
  interviewSubmitLimiter,
  async (req, res) => {
    const session = await db.interviews.findOne((i) => i.token === req.params.token);
    if (!session) {
      res.status(404).json({ error: "Invalid interview token." });
      return;
    }
    if (req.user?.role === "student" && req.user.id !== session.candidateId) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    if (session.status === "revoked") {
      res.status(403).json({ error: "This interview invitation has been revoked." });
      return;
    }
    if (new Date(session.deadlineAt).getTime() < Date.now()) {
      await db.interviews.updateById(session.id, { status: "expired" });
      res.status(410).json({ error: "This interview deadline has passed." });
      return;
    }
    if (session.status === "submitted" || session.status === "report_ready") {
      res.status(409).json({ error: "This interview has already been submitted." });
      return;
    }

    const now = new Date().toISOString();
    const updated = (await db.interviews.updateById(session.id, {
      status: "in_progress",
      startedAt: session.startedAt ?? now,
      auditTrail: session.startedAt
        ? session.auditTrail
        : [...session.auditTrail, { timestamp: now, message: "Candidate started interview timer." }],
    }))!;

    await db.applications.updateById(session.applicationId, {
      interviewStatus: "in_progress",
      updatedAt: now,
    });

    res.json({
      session: updated,
      remainingSeconds: computeRemainingSeconds(updated),
    });
  }
);

interviewsRouter.put(
  "/interviews/token/:token/answers",
  interviewSubmitLimiter,
  async (req, res) => {
    const schema = z
      .object({
        questionId: z.string().min(1),
        answerText: z.string().max(15000),
      })
      .strict();

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid answer payload." });
      return;
    }

    const session = await db.interviews.findOne((i) => i.token === req.params.token);
    if (!session) {
      res.status(404).json({ error: "Invalid interview token." });
      return;
    }
    if (req.user?.role === "student" && req.user.id !== session.candidateId) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    if (session.status === "submitted" || session.status === "report_ready") {
      res.status(409).json({ error: "Interview already submitted; answers are locked." });
      return;
    }
    if (session.status === "revoked" || session.status === "expired") {
      res.status(410).json({ error: `Interview is ${session.status}.` });
      return;
    }

    const remaining = computeRemainingSeconds(session);
    if (remaining <= 0) {
      res.status(410).json({ error: "Interview timer has expired." });
      return;
    }

    const now = new Date().toISOString();
    const wordCount = parsed.data.answerText.trim()
      ? parsed.data.answerText.trim().split(/\s+/).length
      : 0;

    const answers: InterviewAnswer[] = [...session.answers];
    const idx = answers.findIndex((a) => a.questionId === parsed.data.questionId);
    const nextAns: InterviewAnswer = {
      questionId: parsed.data.questionId,
      answerText: parsed.data.answerText,
      wordCount,
      updatedAt: now,
    };
    if (idx >= 0) answers[idx] = nextAns;
    else answers.push(nextAns);

    await db.interviews.updateById(session.id, {
      answers,
      status: session.status === "invited" ? "in_progress" : session.status,
      startedAt: session.startedAt ?? now,
    });

    res.json({ savedAt: now, wordCount, remainingSeconds: remaining });
  }
);

interviewsRouter.post(
  "/interviews/token/:token/submit",
  interviewSubmitLimiter,
  async (req, res) => {
    const session = await db.interviews.findOne((i) => i.token === req.params.token);
    if (!session) {
      res.status(404).json({ error: "Invalid interview token." });
      return;
    }
    if (req.user?.role === "student" && req.user.id !== session.candidateId) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    // Idempotent final submit guard
    if (
      session.status === "submitted" ||
      session.status === "report_ready" ||
      session.status === "report_failed"
    ) {
      res.json({
        alreadySubmitted: true,
        session: {
          id: session.id,
          status: session.status,
          submittedAt: session.submittedAt,
        },
      });
      return;
    }

    if (session.status === "revoked") {
      res.status(403).json({ error: "Interview invitation was revoked." });
      return;
    }

    // Persist any final answers bundled in submit call
    if (Array.isArray(req.body?.answers)) {
      const merged = [...session.answers];
      for (const incoming of req.body.answers) {
        if (incoming?.questionId && typeof incoming?.answerText === "string") {
          const idx = merged.findIndex((a) => a.questionId === incoming.questionId);
          const item: InterviewAnswer = {
            questionId: incoming.questionId,
            answerText: incoming.answerText,
            wordCount: incoming.answerText.trim()
              ? incoming.answerText.trim().split(/\s+/).length
              : 0,
            updatedAt: new Date().toISOString(),
          };
          if (idx >= 0) merged[idx] = item;
          else merged.push(item);
        }
      }
      session.answers = merged;
    }

    const now = new Date().toISOString();
    await db.interviews.updateById(session.id, {
      answers: session.answers,
      status: "submitted",
      submittedAt: now,
      auditTrail: [
        ...session.auditTrail,
        {
          timestamp: now,
          message: `Candidate submitted ${session.answers.length}/${session.questions.length} scenario answers.`,
        },
      ],
    });

    await db.applications.updateById(session.applicationId, {
      applicationStatus: "interview_completed",
      interviewStatus: "submitted",
      updatedAt: now,
    });

    // Trigger AI interview evaluation
    const job = await db.jobs.findById(session.jobId);
    const app = await db.applications.findById(session.applicationId);
    const portfolio = await db.portfolios.findOne((p) => p.userId === session.candidateId);

    if (job && app) {
      try {
        const reportBody = await evaluateInterviewWithAI({
          job,
          session,
          portfolio,
          atsWeightedScore: app.weightedScore,
        });
        const report: InterviewReport = {
          ...reportBody,
          id: `rep_${crypto.randomUUID().slice(0, 12)}`,
          interviewId: session.id,
          applicationId: app.id,
          jobId: job.id,
          companyId: job.companyId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.interviewReports.insert(report);
        await db.interviews.updateById(session.id, {
          status: "report_ready",
          reportId: report.id,
          auditTrail: [
            ...session.auditTrail,
            { timestamp: now, message: "Candidate submitted scenario answers." },
            {
              timestamp: new Date().toISOString(),
              message: "AI Rubric engine parsed & verified citations.",
            },
          ],
        });
        await db.applications.updateById(app.id, {
          interviewStatus: "report_ready",
          updatedAt: new Date().toISOString(),
        });
      } catch {
        await db.interviews.updateById(session.id, {
          status: "report_failed",
        });
        await db.applications.updateById(app.id, {
          interviewStatus: "report_failed",
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const finalSession = await db.interviews.findById(session.id);
    res.json({
      alreadySubmitted: false,
      session: {
        id: finalSession!.id,
        status: finalSession!.status,
        submittedAt: finalSession!.submittedAt,
      },
    });
  }
);

// 4. Recruiter Interview Report View & Action Deck
interviewsRouter.get(
  "/recruiter/applications/:applicationId/interview-report",
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

    const session = app.interviewId
      ? await db.interviews.findById(app.interviewId)
      : await db.interviews.findOne((i) => i.applicationId === app.id);

    if (!session) {
      res.status(404).json({ error: "No AI text interview found for this application." });
      return;
    }

    const report = session.reportId
      ? await db.interviewReports.findById(session.reportId)
      : await db.interviewReports.findOne((r) => r.interviewId === session.id);

    const job = await db.jobs.findById(app.jobId);

    res.json({ application: app, job, session, report: report ?? null });
  }
);

interviewsRouter.post(
  "/recruiter/applications/:applicationId/interview-report/retry",
  requireAuth,
  requireRole("recruiter"),
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

    const session = await db.interviews.findOne((i) => i.applicationId === app.id);
    const job = await db.jobs.findById(app.jobId);
    if (!session || !job) {
      res.status(404).json({ error: "Interview session not found." });
      return;
    }

    const portfolio = await db.portfolios.findOne((p) => p.userId === app.candidateId);
    try {
      const body = await evaluateInterviewWithAI({
        job,
        session,
        portfolio,
        atsWeightedScore: app.weightedScore,
      });
      const report: InterviewReport = {
        ...body,
        id: `rep_${crypto.randomUUID().slice(0, 12)}`,
        interviewId: session.id,
        applicationId: app.id,
        jobId: job.id,
        companyId: job.companyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.interviewReports.insert(report);
      await db.interviews.updateById(session.id, {
        status: "report_ready",
        reportId: report.id,
      });
      await db.applications.updateById(app.id, {
        interviewStatus: "report_ready",
        updatedAt: new Date().toISOString(),
      });
      res.json({ report });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to evaluate interview.",
      });
    }
  }
);

interviewsRouter.post(
  "/recruiter/applications/:applicationId/interview-report/decision",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const schema = z
      .object({
        recommendation: z.enum(["strong_no", "no_hire", "neutral", "hire", "strong"]),
        notes: z.string().max(3000).default(""),
        action: z.enum(["advance_panel", "hold", "not_selected", "save_notes"]),
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

    const report = await db.interviewReports.findOne((r) => r.applicationId === app.id);
    if (report) {
      await db.interviewReports.updateById(report.id, {
        recruiterRecommendation: parsed.data.recommendation,
        recruiterNotes: parsed.data.notes,
        updatedAt: new Date().toISOString(),
      });
    }

    const patch: Record<string, unknown> = {
      recruiterNotes: parsed.data.notes,
      updatedAt: new Date().toISOString(),
    };
    if (parsed.data.action === "advance_panel") {
      patch.recruiterDecision = "selected";
      patch.applicationStatus = "selected";
    } else if (parsed.data.action === "hold") {
      patch.recruiterDecision = "on_hold";
      patch.applicationStatus = "on_hold";
    } else if (parsed.data.action === "not_selected") {
      patch.recruiterDecision = "not_selected";
      patch.applicationStatus = "not_selected";
    }

    const updatedApp = await db.applications.updateById(app.id, patch);

    await writeAuditLog({
      actorId: req.user!.id,
      actorRole: "recruiter",
      action: "interview_report_decision",
      targetType: "application",
      targetId: app.id,
      companyId: app.companyId,
      newState: {
        recommendation: parsed.data.recommendation,
        action: parsed.data.action,
      },
      requestId: req.requestId,
    });

    res.json({ application: updatedApp, report: await db.interviewReports.findOne((r) => r.applicationId === app.id) });
  }
);
