import crypto from "crypto";
import express from "express";
import { z } from "zod";
import type { StudentPortfolio } from "../../../shared/types";
import { db } from "../db/database";
import { requireAuth, requireRole } from "../middleware/auth";

export const portfoliosRouter = express.Router();

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "candidate";
}

const PortfolioPayloadSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  headline: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(30).optional(),
  location: z.string().trim().max(120).optional(),
  summary: z.string().trim().max(2500).optional(),
  slug: z.string().trim().max(80).optional(),
  education: z
    .array(
      z.object({
        id: z.string().min(1),
        institution: z.string().trim().min(1),
        qualification: z.string().trim().min(1),
        fieldOfStudy: z.string().trim().min(1),
        startYear: z.number().int().min(1960).max(2040),
        endYear: z.number().int().min(1960).max(2045).nullable().optional(),
        status: z.enum(["ongoing", "completed"]),
        coursework: z.string().optional(),
      })
    )
    .default([]),
  skills: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        selfRating: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      })
    )
    .default([]),
  projects: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        roleContribution: z.string().trim().min(1),
        technologies: z.array(z.string()).default([]),
        projectUrl: z.string().trim().url().optional().or(z.literal("")),
        githubUrl: z.string().trim().url().optional().or(z.literal("")),
        demoUrl: z.string().trim().url().optional().or(z.literal("")),
      })
    )
    .default([]),
  links: z
    .object({
      linkedin: z.string().trim().url().optional().or(z.literal("")),
      github: z.string().trim().url().optional().or(z.literal("")),
      website: z.string().trim().url().optional().or(z.literal("")),
    })
    .default({}),
  certifications: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1),
        issuer: z.string().trim().min(1),
        date: z.string().optional(),
        credentialUrl: z.string().trim().url().optional().or(z.literal("")),
      })
    )
    .default([]),
  visibility: z.enum(["private", "public"]).default("private"),
  onboardingCompleted: z.boolean().default(false),
});

portfoliosRouter.get("/portfolios/me", requireAuth, requireRole("student"), async (req, res) => {
  const portfolio = await db.portfolios.findOne((p) => p.userId === req.user!.id);
  res.json({ portfolio: portfolio ?? null });
});

portfoliosRouter.put("/portfolios/me", requireAuth, requireRole("student"), async (req, res) => {
  const parsed = PortfolioPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
    return;
  }

  const existing = await db.portfolios.findOne((p) => p.userId === req.user!.id);
  const now = new Date().toISOString();

  // Resolve unique slug
  let desiredSlug = slugifyName(
    parsed.data.slug || existing?.slug || parsed.data.displayName
  );
  const collision = await db.portfolios.findOne(
    (p) => p.slug === desiredSlug && p.userId !== req.user!.id
  );
  if (collision) {
    desiredSlug = `${desiredSlug}-${crypto.randomUUID().slice(0, 4)}`;
  }

  const cleanProjects = parsed.data.projects.map((pr) => ({
    ...pr,
    projectUrl: pr.projectUrl || undefined,
    githubUrl: pr.githubUrl || undefined,
    demoUrl: pr.demoUrl || undefined,
  }));

  const cleanCerts = parsed.data.certifications.map((c) => ({
    ...c,
    credentialUrl: c.credentialUrl || undefined,
  }));

  const record: StudentPortfolio = {
    id: existing?.id ?? `prt_${crypto.randomUUID().slice(0, 12)}`,
    userId: req.user!.id,
    slug: desiredSlug,
    displayName: parsed.data.displayName,
    email: parsed.data.email,
    headline: parsed.data.headline,
    phone: parsed.data.phone,
    location: parsed.data.location,
    summary: parsed.data.summary,
    education: parsed.data.education,
    skills: parsed.data.skills,
    projects: cleanProjects,
    links: {
      linkedin: parsed.data.links.linkedin || undefined,
      github: parsed.data.links.github || undefined,
      website: parsed.data.links.website || undefined,
    },
    certifications: cleanCerts,
    visibility: parsed.data.visibility,
    onboardingCompleted:
      parsed.data.onboardingCompleted || parsed.data.visibility === "public",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.portfolios.upsert(record);
  await db.users.updateById(req.user!.id, { name: record.displayName });

  res.json({ portfolio: record });
});

portfoliosRouter.get("/public/portfolios/:slug", async (req, res) => {
  const portfolio = await db.portfolios.findOne((p) => p.slug === req.params.slug);
  if (!portfolio) {
    res.status(404).json({ error: "Candidate portfolio not found." });
    return;
  }

  const isOwner = req.user?.id === portfolio.userId;
  const isRecruiterOrAdmin = req.user?.role === "recruiter" || req.user?.role === "admin";
  if (portfolio.visibility !== "public" && !isOwner && !isRecruiterOrAdmin) {
    res.status(404).json({ error: "This portfolio is currently set to private." });
    return;
  }

  // Strip personal phone from public unauthenticated response
  const { phone: _phone, ...publicSafe } = portfolio;
  res.json({
    portfolio: isOwner ? portfolio : publicSafe,
  });
});
