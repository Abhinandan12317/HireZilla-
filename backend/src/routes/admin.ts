import express from "express";
import { z } from "zod";
import { db } from "../db/database";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAuditLog } from "../services/audit";

export const adminRouter = express.Router();

adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get("/admin/overview", async (_req, res) => {
  const [users, companies, jobs, flags, audits, notifications] = await Promise.all([
    db.users.findAll(),
    db.companies.findAll(),
    db.jobs.findAll(),
    db.flags.findAll(),
    db.auditLogs.findAll(),
    db.notifications.findAll(),
  ]);

  audits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    counts: {
      activeUsers: users.filter((u) => u.status === "active").length,
      companiesNotVerified: companies.filter((c) => c.verificationStatus === "not_verified")
        .length,
      openJobs: jobs.filter((j) => j.status === "open").length,
      openFlags: flags.filter((f) => f.status === "open").length,
    },
    recentAudits: audits.slice(0, 12),
    notificationsCount: notifications.length,
  });
});

adminRouter.get("/admin/flags", async (_req, res) => {
  const flags = await db.flags.findAll();
  flags.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ flags });
});

adminRouter.post("/admin/flags/:flagId/resolve", async (req, res) => {
  const schema = z
    .object({
      action: z.enum(["dismiss", "hide_job", "suspend_company", "suspend_user"]),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Moderation action and reason (min 5 chars) are required." });
    return;
  }

  const flag = await db.flags.findById(req.params.flagId);
  if (!flag) {
    res.status(404).json({ error: "Flag not found." });
    return;
  }

  const now = new Date().toISOString();
  if (parsed.data.action === "hide_job") {
    await db.jobs.updateById(flag.targetId, { status: "hidden", updatedAt: now });
  } else if (parsed.data.action === "suspend_company") {
    await db.companies.updateById(flag.targetId, { status: "suspended", updatedAt: now });
    const companyJobs = await db.jobs.findMany((j) => j.companyId === flag.targetId);
    for (const j of companyJobs) {
      await db.jobs.updateById(j.id, { status: "paused", updatedAt: now });
    }
  } else if (parsed.data.action === "suspend_user") {
    await db.users.updateById(flag.targetId, { status: "suspended" });
  }

  const updated = await db.flags.updateById(flag.id, {
    status: parsed.data.action === "dismiss" ? "dismissed" : "action_taken",
    resolutionNote: parsed.data.reason,
    resolvedBy: req.user!.id,
    resolvedAt: now,
  });

  await writeAuditLog({
    actorId: req.user!.id,
    actorRole: "admin",
    action: `admin_moderation_${parsed.data.action}`,
    targetType: flag.targetType,
    targetId: flag.targetId,
    reason: parsed.data.reason,
    requestId: req.requestId,
  });

  res.json({ flag: updated });
});

adminRouter.get("/admin/records", async (_req, res) => {
  const [users, companies, jobs] = await Promise.all([
    db.users.findAll(),
    db.companies.findAll(),
    db.jobs.findAll(),
  ]);

  res.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    })),
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      location: c.location,
      status: c.status,
      verificationStatus: c.verificationStatus,
      packageCode: c.packageCode,
      createdAt: c.createdAt,
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      companyId: j.companyId,
      companyName: j.companyName,
      status: j.status,
      applicationCount: j.applicationCount,
      applicationCap: j.applicationCap,
      createdAt: j.createdAt,
    })),
  });
});

adminRouter.post("/admin/records/toggle-status", async (req, res) => {
  const schema = z
    .object({
      targetType: z.enum(["user", "company", "job"]),
      targetId: z.string().min(1),
      nextStatus: z.string().min(1),
      reason: z.string().trim().min(5).max(500),
    })
    .strict();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Target, status, and reason (min 5 chars) required." });
    return;
  }

  const now = new Date().toISOString();
  if (parsed.data.targetType === "user") {
    await db.users.updateById(parsed.data.targetId, {
      status: parsed.data.nextStatus as "active" | "suspended",
    });
  } else if (parsed.data.targetType === "company") {
    await db.companies.updateById(parsed.data.targetId, {
      status: parsed.data.nextStatus as "active" | "suspended",
      updatedAt: now,
    });
  } else {
    await db.jobs.updateById(parsed.data.targetId, {
      status: parsed.data.nextStatus as "open" | "paused" | "hidden" | "closed",
      updatedAt: now,
    });
  }

  await writeAuditLog({
    actorId: req.user!.id,
    actorRole: "admin",
    action: `admin_status_override_${parsed.data.targetType}`,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reason: parsed.data.reason,
    newState: { status: parsed.data.nextStatus },
    requestId: req.requestId,
  });

  res.json({ ok: true });
});

adminRouter.get("/admin/audit-logs", async (_req, res) => {
  const logs = await db.auditLogs.findAll();
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ logs: logs.slice(0, 200) });
});

adminRouter.get("/admin/notifications", async (_req, res) => {
  const emails = await db.notifications.findAll();
  emails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ notifications: emails.slice(0, 100) });
});
