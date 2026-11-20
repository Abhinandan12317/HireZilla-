import crypto from "crypto";
import express from "express";
import { z } from "zod";
import { HATCHLING_ENTITLEMENT, PACKAGE_CATALOGUE } from "../../../shared/constants";
import type { Company } from "../../../shared/types";
import { db } from "../db/database";
import { assertCompanyAccess, requireAuth, requireRole } from "../middleware/auth";
import { writeAuditLog } from "../services/audit";

export const companiesRouter = express.Router();

companiesRouter.get("/packages", (_req, res) => {
  res.json({
    activeMvpPackageCode: HATCHLING_ENTITLEMENT.packageCode,
    entitlements: HATCHLING_ENTITLEMENT,
    catalogue: PACKAGE_CATALOGUE,
  });
});

companiesRouter.get("/companies/mine", requireAuth, requireRole("recruiter"), async (req, res) => {
  const company = req.user!.companyId
    ? await db.companies.findById(req.user!.companyId)
    : await db.companies.findOne(
        (c) => c.ownerUserId === req.user!.id || c.memberUserIds.includes(req.user!.id)
      );
  res.json({ company: company ?? null });
});

const CompanyInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    website: z.string().trim().url().optional().or(z.literal("")),
    industry: z.string().trim().max(100).optional(),
    size: z.string().trim().max(50).optional(),
    location: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional(),
    logoUrl: z.string().trim().url().optional().or(z.literal("")),
  })
  .strict();

companiesRouter.post("/companies", requireAuth, requireRole("recruiter"), async (req, res) => {
  const parsed = CompanyInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
    return;
  }

  const existing = await db.companies.findOne(
    (c) => c.ownerUserId === req.user!.id || c.memberUserIds.includes(req.user!.id)
  );
  if (existing) {
    res.status(409).json({
      error: "Recruiter already manages a company profile.",
      company: existing,
    });
    return;
  }

  const now = new Date().toISOString();
  const company: Company = {
    id: `cmp_${crypto.randomUUID().slice(0, 12)}`,
    name: parsed.data.name,
    website: parsed.data.website || undefined,
    industry: parsed.data.industry || undefined,
    size: parsed.data.size || undefined,
    location: parsed.data.location,
    description: parsed.data.description || undefined,
    logoUrl: parsed.data.logoUrl || undefined,
    ownerUserId: req.user!.id,
    memberUserIds: [req.user!.id],
    status: "active",
    verificationStatus: "not_verified",
    packageCode: "HATCHLING_FREE",
    packageActivatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await db.companies.insert(company);
  await db.users.updateById(req.user!.id, { companyId: company.id });

  await writeAuditLog({
    actorId: req.user!.id,
    actorRole: "recruiter",
    action: "company_created",
    targetType: "company",
    targetId: company.id,
    companyId: company.id,
    newState: {
      name: company.name,
      verificationStatus: company.verificationStatus,
      packageCode: company.packageCode,
    },
    requestId: req.requestId,
  });

  res.status(201).json({ company });
});

companiesRouter.patch(
  "/companies/:companyId",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const access = await assertCompanyAccess(req.user!, req.params.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    const parsed = CompanyInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      return;
    }

    const updated = await db.companies.updateById(req.params.companyId, {
      ...parsed.data,
      website: parsed.data.website === "" ? undefined : parsed.data.website,
      logoUrl: parsed.data.logoUrl === "" ? undefined : parsed.data.logoUrl,
      verificationStatus: "not_verified", // immutable in MVP
      updatedAt: new Date().toISOString(),
    });

    if (updated) {
      // Keep denormalized job companyName in sync
      const companyJobs = await db.jobs.findMany((j) => j.companyId === updated.id);
      for (const j of companyJobs) {
        await db.jobs.updateById(j.id, { companyName: updated.name });
      }
    }

    res.json({ company: updated });
  }
);

companiesRouter.post(
  "/companies/:companyId/package/activate-hatchling",
  requireAuth,
  requireRole("recruiter"),
  async (req, res) => {
    const access = await assertCompanyAccess(req.user!, req.params.companyId);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.message });
      return;
    }

    const company = await db.companies.findById(req.params.companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found." });
      return;
    }

    const now = new Date().toISOString();
    const updated = await db.companies.updateById(company.id, {
      packageCode: "HATCHLING_FREE",
      packageActivatedAt: company.packageActivatedAt ?? now,
      updatedAt: now,
    });

    res.json({
      company: updated,
      entitlement: HATCHLING_ENTITLEMENT,
      message: "Hatchling (Free) package is active for your workspace.",
    });
  }
);
