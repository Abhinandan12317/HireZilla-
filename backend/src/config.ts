import crypto from "crypto";
import path from "path";

const ephemeralDevSessionSecret = crypto.randomBytes(32).toString("hex");
const ephemeralDevSignedSecret = crypto.randomBytes(32).toString("hex");

const parsedCorsOrigins = (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || "development";
const hasCrossOriginConfig = parsedCorsOrigins.length > 0;
const cookieSameSiteEnv = process.env.COOKIE_SAME_SITE as "lax" | "strict" | "none" | undefined;
const cookieSameSite: "lax" | "strict" | "none" =
  cookieSameSiteEnv || (hasCrossOriginConfig && nodeEnv === "production" ? "none" : "lax");
const cookieSecure =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : nodeEnv === "production" || cookieSameSite === "none";

export const config = {
  port: Number(process.env.BACKEND_PORT || process.env.PORT || 4000),
  nodeEnv,
  isTest: nodeEnv === "test" || Boolean(process.env.VITEST),
  appUrl: process.env.APP_URL || "http://localhost:3000",
  frontendUrl: (process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  ),
  corsOrigins: parsedCorsOrigins,
  cookieSameSite,
  cookieSecure,
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  mongodbUri: process.env.MONGODB_URI || "",
  mongodbDbName: process.env.MONGODB_DB_NAME || "hirezilla",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: "gemini-4-hydrogen" as const,
  googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "",
  sessionSecret: process.env.SESSION_SECRET || ephemeralDevSessionSecret,
  signedUrlSecret: process.env.SIGNED_URL_SECRET || ephemeralDevSignedSecret,
  usingEphemeralSecrets: !process.env.SESSION_SECRET,
  adminBootstrapEmails: (process.env.ADMIN_BOOTSTRAP_EMAILS || "admin@hirezilla.local")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  resumeMaxSizeBytes: Number(process.env.RESUME_MAX_SIZE_MB || 5) * 1024 * 1024,
  resumeMaxPages: Number(process.env.RESUME_MAX_PAGES || 10),
  ocrEnabled: process.env.OCR_ENABLED === "true",
  privateStorageDir: path.resolve(process.cwd(), "private_storage"),
  dataDir: path.resolve(process.cwd(), "data"),
  signedUrlTtlSeconds: 180,
  aiMaxRetries: 2,
  aiTimeoutMs: 25000,
  interviewMinQuestions: 3,
  interviewMaxQuestions: 8,
  interviewMaxDurationMinutes: 120,
} as const;
