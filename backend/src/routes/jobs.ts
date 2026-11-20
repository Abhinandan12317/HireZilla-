import crypto from "crypto";
import express from "express";
import { z } from "zod";
import { HATCHLING_ENTITLEMENT } from "../../../shared/constants";
import type { JobEvaluationProfile, JobPosting, ReferralTokenRecord } from "../../../shared/types";
import { db } from "../db/database";
import { assertCompanyAccess, requireAuth, requireRole } from "../middleware/auth";
import { generateJobEvaluationProfileWithAI } from "../services/ai";
import { writeAuditLog } from "../services/audit";

export const jobsRouter = express.Router();

// Public jobs discovery with AND filters
jobsRouter.get("/public/jobs", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const location = String(req.query.location || "").trim().toLowerCase();
  const workMode = String(req.query.workMode || "").trim().toLowerCase();
  const employmentType = String(req.query.employmentType || "").trim().toLowerCase();
  const experience = String(req.query.experience || "").trim().toLowerCase();
  const sort = String(req.query.sort || "newest");

  const allJobs = await db.jobs.findMany((j) => j.status === "open");
  const filtered = allJobs.filter((j) => {
    if (q) {
      const hay = [
        j.title,
        j.companyName,
        j.summary,
        j.description,
        ...j.requiredSkills,
        ...j.preferredSkills,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (location && !j.location.toLowerCase().includes(location)) return false;
    if (workMode && j.workMode !== workMode) return false;
    if (employmentType && j.employmentType !== employmentType) return false;
    if (experience && !j.experienceLevel.toLowerCase().includes(experience)) return false;
    return true;
  });

  if (sort === "title_asc") {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  res.json({ jobs: filtered, total: filtered.length });
});

jobsRouter.get("/public/jobs/:jobId", async (req, res) => {
  const job = await db.jobs.findById(req.params.jobId);
  if (!job || job.status === "hidden" || job.status === "draft") {
    res.status(404).json({ error: "Job posting not found." });
    return;
  }

  let existingApplicationId: string | null = null;
  if (req.user?.role === "student") {
    const existingApp = await db.applications.findOne(
      (a) => a.jobId === job.id && a.candidateId === req.user!.id
    );
    existingApplicationId = existingApp?.id ?? null;
  }

  res.json({
    job,
    capReached: job.applicationCount >= job.applicationCap,
    existingApplicationId,
  });
});

jobsRouter.post("/public/jobs/:jobId/report", async (req, res) => {
  const schema = z
    .object({
      reason: z.string().trim().min(5).max(300),
      details: z.string().trim().max(1500).optional(),
    })
    .strict();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide a clear report reason (min 5 chars)." });
    return;
  }

  const job = await db.jobs.findById(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }

  const flag = await db.flags.insert({
    id: `flg_${crypto.randomUUID().slice(0, 12)}`,
    targetType: "job",
    targetId: job.id,
    targetTitle: `${job.title} (${job.companyName})`,
    reporterUserId: req.user?.id ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details,
    status: "open",
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ flag });
});

// Recruiter job endpoints
const JobCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  department: z.string().trim().max(100).optional(),
  employmentType: z.enum(["full_time", "internship", "contract", "part_time"]),
  workMode: z.enum(["remote", "hybrid", "onsite"]),
  location: z.string().trim().min(2).max(120),
  experienceLevel: z.string().trim().min(1).max(80),
  experienceYearsMin: z.number().min(0).max(40).optional(),
  experienceYearsMax: z.number().min(0).max(40).optional(),
  educationRequirement: z.string().trim().max(300).optional(),
  eligibilityRequirements: z.array(z.string().trim().min(1)).default([]),
  summary: z.string().trim().min(10).max(500),
  description: z.string().trim().min(20).max(8000),
  responsibilities: z.array(z.string().trim().min(1)).default([]),
  requiredSkills: z.array(z.string().trim().min(1)).min(1),
  preferredSkills: z.array(z.string().trim().min(1)).default([]),
  compensationDisplay: z.string().trim().max(100).optional(),
  closingDate: z.string().nullable().optional(),
});

jobsRouter.get("/recruiter/jobs", requireAuth, requireRole("recruiter"), async (req, res) => {
  const company = req.user!.companyId
    ? await db.companies.findById(req.user!.companyId)
    : await db.companies.findOne(
        (c) => c.ownerUserId === req.user!.id || c.memberUserIds.includes(req.user!.id)
      );

  if (!company) {
    res.json({ jobs: [], company: null });
    return;
  }

  const jobs = await db.jobs.findMany((j) => j.companyId === company.id);
  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ jobs, company });
});

jobsRouter.get("/recruiter/jobs/:jobId", requireAuth, requireRole("recruiter"), async (req, res) => {
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

  const profiles = await db.jobEvaluationProfiles.findMany((p) => p.jobId === job.id);
  profiles.sort((a, b) => Number(b.profileVersion) - Number(a.profileVersion));

  res.json({ job, profiles, activeProfile: profiles[0] ?? null });
});

jobsRouter.post("/recruiter/jobs", requireAuth, requireRole("recruiter"), async (req, res) => {
  const parsed = JobCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
    return;
  }

  const company = req.user!.companyId
    ? await db.companies.findById(req.user!.companyId)
    : await db.companies.findOne(
        (c) => c.ownerUserId === req.user!.id || c.memberUserIds.includes(req.user!.id)
      );

  if (!company) {
    res.status(400).json({ error: "Please create your Company Profile before creating jobs." });
    return;
  }
  if (company.status === "suspended") {
    res.status(403).json({ error: "Company is suspended and cannot create jobs." });
    return;
  }

  const now = new Date().toISOString();
  const job: JobPosting = {
    id: `job_${crypto.randomUUID().slice(0, 12)}`,
    companyId: company.id,
    companyName: company.name,
    companyVerificationStatus: company.verificationStatus,
    ...parsed.data,
    applicationCap: HATCHLING_ENTITLEMENT.maxApplicationsPerJob,
    applicationCount: 0,
    status: "draft",
    activeEvaluationProfileId: null,
    activeEvaluationProfileVersion: null,
    evaluationProfileStatus: "none",
    createdBy: req.user!.id,
    createdAt: now,
    updatedAt: now,
  };

  await db.jobs.insert(job);
  await writeAuditLog({
    actorId: req.user!.id,
    actorRole: "recruiter",
    action: "job_created_draft",
    targetType: "job",
    targetId: job.id,
    companyId: company.id,
    requestId: req.requestId,
  });

  res.status(201).json({ job });
});

jobsRouter.patch(
  "/recruiter/jobs/:jobId",
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

    const parsed = JobCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      return;
    }

    // Check if scoring-relevant JD fields changed -> mark existing profile stale (ResumeScoring_Rules §3.4)
    const jdFieldsChanged =
      parsed.data.title !== undefined ||
      parsed.data.description !== undefined ||
      parsed.data.summary !== undefined ||
      parsed.data.requiredSkills !== undefined ||
      parsed.data.preferredSkills !== undefined ||
      parsed.data.experienceLevel !== undefined ||
      parsed.data.educationRequirement !== undefined ||
      parsed.data.eligibilityRequirements !== undefined;

    let evaluationProfileStatus = job.evaluationProfileStatus;
    if (jdFieldsChanged && job.activeEvaluationProfileId) {
      await db.jobEvaluationProfiles.updateById(job.activeEvaluationProfileId, {
        status: "stale",
      });
      evaluationProfileStatus = "stale";
    }

    const updated = (await db.jobs.updateById(job.id, {
      ...parsed.data,
      evaluationProfileStatus,
      updatedAt: new Date().toISOString(),
    }))!;

    res.json({ job: updated, profileMarkedStale: jdFieldsChanged && Boolean(job.activeEvaluationProfileId) });
  }
);

jobsRouter.post(
  "/jobs/:jobId/evaluation-profile/generate",
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

    const existingProfiles = await db.jobEvaluationProfiles.findMany((p) => p.jobId === job.id);
    const nextVersion = String(
      existingProfiles.reduce((max, p) => Math.max(max, Number(p.profileVersion) || 0), 0) + 1
    );

    try {
      const generated = await generateJobEvaluationProfileWithAI(
        job,
        req.user!.id,
        nextVersion
      );

      // Mark previous profiles stale without deleting history
      for (const old of existingProfiles) {
        if (old.status === "ready") {
          await db.jobEvaluationProfiles.updateById(old.id, { status: "stale" });
        }
      }

      const profile: JobEvaluationProfile = {
        ...generated,
        id: `prof_${crypto.randomUUID().slice(0, 12)}`,
        createdAt: new Date().toISOString(),
      };
      await db.jobEvaluationProfiles.insert(profile);

      await db.jobs.updateById(job.id, {
        activeEvaluationProfileId: profile.id,
        activeEvaluationProfileVersion: profile.profileVersion,
        evaluationProfileStatus: profile.status,
        updatedAt: new Date().toISOString(),
      });

      await writeAuditLog({
        actorId: req.user!.id,
        actorRole: "recruiter",
        action: "job_evaluation_profile_generated",
        targetType: "job",
        targetId: job.id,
        companyId: job.companyId,
        newState: {
          profileId: profile.id,
          profileVersion: profile.profileVersion,
          criteriaCount: profile.criteria.length,
        },
        requestId: req.requestId,
      });

      res.json({
        jobId: job.id,
        profileVersion: profile.profileVersion,
        rubricVersion: profile.rubricVersion,
        status: profile.status,
        criteriaCount: profile.criteria.length,
        ambiguities: profile.ambiguities,
        profile,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate job evaluation profile.";
      await db.jobs.updateById(job.id, {
        evaluationProfileStatus: "failed",
        updatedAt: new Date().toISOString(),
      });
      res.status(502).json({ error: msg, status: "failed" });
    }
  }
);

jobsRouter.get(
  "/jobs/:jobId/evaluation-profile",
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

    const profiles = await db.jobEvaluationProfiles.findMany((p) => p.jobId === job.id);
    profiles.sort((a, b) => Number(b.profileVersion) - Number(a.profileVersion));
    res.json({
      activeProfile:
        profiles.find((p) => p.id === job.activeEvaluationProfileId) ?? profiles[0] ?? null,
      versions: profiles,
    });
  }
);

jobsRouter.post(
  "/recruiter/jobs/:jobId/publish",
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

    const company = await db.companies.findById(job.companyId);
    if (!company || company.packageCode !== "HATCHLING_FREE") {
      res.status(403).json({ error: "Active Hatchling package required before publishing." });
      return;
    }

    if (job.evaluationProfileStatus !== "ready" || !job.activeEvaluationProfileId) {
      res.status(400).json({
        error:
          "Generate and confirm a ready Job Evaluation Profile before publishing this job.",
      });
      return;
    }

    const updated = await db.jobs.updateById(job.id, {
      status: "open",
      updatedAt: new Date().toISOString(),
    });

    await writeAuditLog({
      actorId: req.user!.id,
      actorRole: "recruiter",
      action: "job_published",
      targetType: "job",
      targetId: job.id,
      companyId: job.companyId,
      requestId: req.requestId,
    });

    res.json({ job: updated });
  }
);

jobsRouter.post(
  "/recruiter/jobs/:jobId/status",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const schema = z.object({ status: z.enum(["open", "paused", "closed"]) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid status value." });
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

    if (job.status === "closed" && parsed.data.status === "open") {
      res.status(400).json({ error: "Closed jobs cannot be reopened once closed." });
      return;
    }

    if (parsed.data.status === "open" && job.evaluationProfileStatus !== "ready") {
      res.status(400).json({ error: "Job evaluation profile must be ready before opening." });
      return;
    }

    const prevStatus = job.status;
    const updated = await db.jobs.updateById(job.id, {
      status: parsed.data.status,
      updatedAt: new Date().toISOString(),
    });

    await writeAuditLog({
      actorId: req.user!.id,
      actorRole: "recruiter",
      action: "job_status_changed",
      targetType: "job",
      targetId: job.id,
      companyId: job.companyId,
      previousState: { status: prevStatus },
      newState: { status: parsed.data.status },
      requestId: req.requestId,
    });

    res.json({ job: updated });
  }
);

jobsRouter.get(
  "/recruiter/jobs/:jobId/referrals",
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

    const tokens = await db.referrals.findMany(
      (r) => r.companyId === job.companyId && (!r.jobId || r.jobId === job.id)
    );
    res.json({ referrals: tokens });
  }
);

jobsRouter.post(
  "/recruiter/jobs/:jobId/referrals",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const schema = z.object({
      referrerName: z.string().trim().min(2).max(100),
      referrerEmail: z.string().trim().email(),
      maxUses: z.number().int().min(1).max(50).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid referrer name and email required." });
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

    const code = `#REF-${Math.floor(1000 + Math.random() * 9000)}`;
    const record: ReferralTokenRecord = {
      id: `ref_${crypto.randomUUID().slice(0, 10)}`,
      code,
      companyId: job.companyId,
      jobId: job.id,
      referrerName: parsed.data.referrerName,
      referrerEmail: parsed.data.referrerEmail.toLowerCase(),
      active: true,
      expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      usedCount: 0,
      maxUses: parsed.data.maxUses ?? 10,
      createdAt: new Date().toISOString(),
    };

    await db.referrals.insert(record);
    res.status(201).json({ referral: record });
  }
);
