import crypto from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { AuthUser, UserRole } from "../../../shared/types";
import { config } from "../config";
import { db } from "../db/database";
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  verifyGoogleIdToken,
} from "../middleware/auth";
import { writeAuditLog } from "../services/audit";

export const authRouter = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: () => config.isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication requests. Please try again shortly." },
});

authRouter.get("/me", async (req, res) => {
  if (!req.user) {
    res.json({
      user: null,
      company: null,
      portfolio: null,
      authConfig: {
        googleClientId: config.googleClientId || null,
        googleEnabled: Boolean(config.googleClientId),
        demoAuthEnabled: true,
      },
    });
    return;
  }

  const company = req.user.companyId
    ? await db.companies.findById(req.user.companyId)
    : req.user.role === "recruiter"
      ? await db.companies.findOne(
          (c) => c.ownerUserId === req.user!.id || c.memberUserIds.includes(req.user!.id)
        )
      : null;

  const portfolio =
    req.user.role === "student"
      ? await db.portfolios.findOne((p) => p.userId === req.user!.id)
      : null;

  res.json({
    user: req.user,
    company,
    portfolio,
    authConfig: {
      googleClientId: config.googleClientId || null,
      googleEnabled: Boolean(config.googleClientId),
      demoAuthEnabled: true,
    },
  });
});

authRouter.post("/google", authLimiter, async (req, res) => {
  try {
    const bodySchema = z.object({ idToken: z.string().min(10) }).strict();
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid Google ID token is required." });
      return;
    }

    const googleUser = await verifyGoogleIdToken(parsed.data.idToken);
    let user = await db.users.findOne((u) => u.email.toLowerCase() === googleUser.email);

    if (!user) {
      const isBootstrapAdmin = config.adminBootstrapEmails.includes(googleUser.email);
      user = await db.users.insert({
        id: `usr_${crypto.randomUUID().slice(0, 12)}`,
        email: googleUser.email,
        name: googleUser.name,
        role: isBootstrapAdmin ? "admin" : null,
        status: "active",
        avatarUrl: googleUser.picture,
        createdAt: new Date().toISOString(),
      });
    }

    if (user.status === "suspended") {
      res.status(403).json({ error: "Your account is currently suspended." });
      return;
    }

    const token = setSessionCookie(res, user);
    res.json({ user, token, needsRoleSelection: user.role === null });
  } catch (err) {
    res.status(401).json({
      error:
        err instanceof Error
          ? err.message
          : "We couldn't sign you in with Google. Please try again.",
    });
  }
});

authRouter.post(["/signup", "/signin", "/login"], authLimiter, async (req, res) => {
  const schema = z
    .object({
      email: z.string().trim().email("Please provide a valid email address."),
      name: z.preprocess(
        (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
        z
          .string()
          .trim()
          .min(2, "Name must be at least 2 characters.")
          .max(80, "Name must not exceed 80 characters.")
          .optional()
      ),
    })
    .strict();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: issue?.message || "Please provide a valid email address." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  let user = await db.users.findOne((u) => u.email.toLowerCase() === email);

  if (!user) {
    const isBootstrapAdmin = config.adminBootstrapEmails.includes(email);
    user = await db.users.insert({
      id: `usr_${crypto.randomUUID().slice(0, 12)}`,
      email,
      name: parsed.data.name?.trim() || email.split("@")[0],
      role: isBootstrapAdmin ? "admin" : null,
      status: "active",
      createdAt: new Date().toISOString(),
    });
  }

  if (user.status === "suspended") {
    res.status(403).json({ error: "Account is suspended." });
    return;
  }

  const token = setSessionCookie(res, user);
  res.json({ user, token, needsRoleSelection: user.role === null });
});

authRouter.post("/demo-signin", authLimiter, async (req, res) => {
  const schema = z
    .object({
      preset: z.enum(["student_arjun", "recruiter_priya", "recruiter_nimbus", "admin"]),
    })
    .strict();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid demo account preset." });
    return;
  }

  const map: Record<string, string> = {
    student_arjun: "usr_student_arjun",
    recruiter_priya: "usr_recruiter_priya",
    recruiter_nimbus: "usr_recruiter_nimbus",
    admin: "usr_admin_root",
  };

  const user = await db.users.findById(map[parsed.data.preset]);
  if (!user) {
    res.status(404).json({ error: "Demo account not found." });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "Demo account is suspended." });
    return;
  }

  const token = setSessionCookie(res, user);
  res.json({ user, token, needsRoleSelection: user.role === null });
});

authRouter.post("/role", requireAuth, async (req, res) => {
  const schema = z
    .object({
      role: z.enum(["student", "recruiter"]),
    })
    .strict();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Please select a valid role: Student or Recruiter. Admin cannot be chosen publicly.",
    });
    return;
  }

  const current = await db.users.findById(req.user!.id);
  if (!current) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  if (current.role !== null) {
    res.status(409).json({
      error: `Account role is already set to ${current.role} and cannot be switched casually.`,
    });
    return;
  }

  const role: UserRole = parsed.data.role;
  const updated = (await db.users.updateById(current.id, { role })) as AuthUser;
  const token = setSessionCookie(res, updated);

  await writeAuditLog({
    actorId: updated.id,
    actorRole: role,
    action: "user_role_selected",
    targetType: "user",
    targetId: updated.id,
    newState: { role },
    requestId: req.requestId,
  });

  res.json({ user: updated, token });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
