import express from "express";
import { db } from "../db/database";
import { requireAuth, requireRole } from "../middleware/auth";

export const dashboardRouter = express.Router();

dashboardRouter.get(
  "/student/dashboard",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    const [portfolio, apps] = await Promise.all([
      db.portfolios.findOne((p) => p.userId === req.user!.id),
      db.applications.findMany((a) => a.candidateId === req.user!.id),
    ]);

    apps.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const completionSteps = [
      Boolean(portfolio?.displayName && portfolio?.summary),
      (portfolio?.education.length ?? 0) > 0,
      (portfolio?.skills.length ?? 0) > 0,
      (portfolio?.projects.length ?? 0) > 0,
      Boolean(portfolio?.links.github || portfolio?.links.linkedin),
    ];

    const enrichedApps = await Promise.all(
      apps.map(async (app) => {
        const [job, interview] = await Promise.all([
          db.jobs.findById(app.jobId),
          app.interviewId ? db.interviews.findById(app.interviewId) : Promise.resolve(null),
        ]);
        return {
          id: app.id,
          jobId: app.jobId,
          jobTitle: job?.title ?? "Job Listing",
          companyName: job?.companyName ?? "Company",
          companyVerificationStatus: job?.companyVerificationStatus ?? "not_verified",
          resumeFilename: app.resumeFilename,
          resumeProcessingStatus: app.resumeProcessingStatus,
          evaluationStatus: app.evaluationStatus,
          applicationStatus: app.applicationStatus,
          recruiterDecision:
            app.recruiterDecision === "shortlisted" ||
            app.recruiterDecision === "interview_invited" ||
            app.recruiterDecision === "selected" ||
            app.recruiterDecision === "not_selected" ||
            app.recruiterDecision === "on_hold"
              ? app.recruiterDecision
              : "pending",
          interviewToken:
            interview && (interview.status === "invited" || interview.status === "in_progress")
              ? interview.token
              : null,
          submittedAt: app.submittedAt,
        };
      })
    );

    const counts = {
      submitted: enrichedApps.length,
      screening: enrichedApps.filter(
        (a) =>
          a.applicationStatus === "submitted" ||
          a.applicationStatus === "screening_in_progress"
      ).length,
      invited: enrichedApps.filter((a) => Boolean(a.interviewToken)).length,
      interviewDone: enrichedApps.filter((a) => a.applicationStatus === "interview_completed")
        .length,
      decisionPending: enrichedApps.filter((a) => a.recruiterDecision === "pending").length,
    };

    res.json({
      portfolio: portfolio ?? null,
      portfolioCompleteness: {
        completedSteps: completionSteps.filter(Boolean).length,
        totalSteps: completionSteps.length,
      },
      counts,
      applications: enrichedApps,
    });
  }
);

dashboardRouter.get(
  "/recruiter/dashboard",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const company = req.user!.companyId
      ? await db.companies.findById(req.user!.companyId)
      : await db.companies.findOne(
          (c) => c.ownerUserId === req.user!.id || c.memberUserIds.includes(req.user!.id)
        );

    if (!company) {
      res.json({
        company: null,
        jobs: [],
        stats: {
          activeJobs: 0,
          totalApplications: 0,
          qualifiedApplicants: 0,
          interviewsPendingReview: 0,
          needsReviewCount: 0,
          failedCount: 0,
        },
      });
      return;
    }

    const [jobs, companyApps] = await Promise.all([
      db.jobs.findMany((j) => j.companyId === company.id),
      db.applications.findMany((a) => a.companyId === company.id),
    ]);

    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const stats = {
      activeJobs: jobs.filter((j) => j.status === "open").length,
      totalApplications: jobs.reduce((sum, j) => sum + j.applicationCount, 0),
      qualifiedApplicants: companyApps.filter((a) => a.screeningResult === "qualified").length,
      interviewsPendingReview: companyApps.filter(
        (a) => a.recruiterDecision === "interview_invited" || Boolean(a.interviewId)
      ).length,
      needsReviewCount: companyApps.filter((a) => a.evaluationStatus === "needs_review").length,
      failedCount: companyApps.filter(
        (a) =>
          a.evaluationStatus === "failed" ||
          a.resumeProcessingStatus === "extraction_failed"
      ).length,
    };

    res.json({
      company,
      jobs,
      stats,
    });
  }
);
