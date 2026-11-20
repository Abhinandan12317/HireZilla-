import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import type { AuthUser, UserRole } from "../../../shared/types";
import { config } from "../config";
import { db } from "../db/database";

const COOKIE_NAME = "hz_session";
const oauthClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole | null;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AuthUser | null;
    }
  }
}

export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const rid = (req.headers["x-request-id"] as string) || `req_${crypto.randomUUID().slice(0, 12)}`;
  req.requestId = rid;
  res.setHeader("x-request-id", rid);
  next();
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, config.sessionSecret, { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, config.sessionSecret) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, user: AuthUser): string {
  const token = signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    domain: config.cookieDomain,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  return token;
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    domain: config.cookieDomain,
  });
}

export async function verifyGoogleIdToken(
  idToken: string
): Promise<{ sub: string; email: string; name: string; picture?: string }> {
  if (!oauthClient || !config.googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured on the server.");
  }
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: config.googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.email_verified) {
    throw new Error("Google account email is missing or unverified.");
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture,
  };
}

export async function hydrateAuthUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined = req.cookies?.[COOKIE_NAME];
    if (!token && typeof req.headers.authorization === "string") {
      const match = req.headers.authorization.match(/^Bearer\s+(.+)$/i);
      if (match) token = match[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = verifySessionToken(token);
    if (!decoded) {
      req.user = null;
      return next();
    }

    const user = await db.users.findById(decoded.userId);
    if (!user || user.status === "suspended") {
      req.user = null;
      return next();
    }

    req.user = user;
    return next();
  } catch {
    req.user = null;
    return next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (req.user.status === "suspended") {
    res.status(403).json({ error: "Account is suspended." });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!req.user.role || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: "You do not have permission to perform this action.",
      });
      return;
    }
    next();
  };
}

export async function assertCompanyAccess(
  user: AuthUser,
  companyId: string
): Promise<{ allowed: boolean; statusCode: number; message?: string }> {
  if (user.role === "admin") {
    return { allowed: true, statusCode: 200 };
  }
  if (user.role !== "recruiter") {
    return { allowed: false, statusCode: 403, message: "Recruiter role required." };
  }
  const company = await db.companies.findById(companyId);
  if (!company) {
    return { allowed: false, statusCode: 404, message: "Company not found." };
  }
  const isMember =
    company.ownerUserId === user.id || company.memberUserIds.includes(user.id);
  if (!isMember) {
    return {
      allowed: false,
      statusCode: 403,
      message: "Cross-company access denied.",
    };
  }
  if (company.status === "suspended") {
    return {
      allowed: false,
      statusCode: 403,
      message: "Company account is suspended.",
    };
  }
  return { allowed: true, statusCode: 200 };
}

export function assertCandidateAccess(user: AuthUser, candidateId: string): boolean {
  if (user.role === "admin") return true;
  return user.role === "student" && user.id === candidateId;
}
