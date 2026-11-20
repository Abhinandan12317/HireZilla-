import crypto from "crypto";
import type { AuditLogRecord, UserRole } from "../../../shared/types";
import { db } from "../db/database";

const SENSITIVE_KEYS = new Set([
  "extractedText",
  "resumeText",
  "rawText",
  "password",
  "token",
  "idToken",
  "apiKey",
  "authorization",
  "cookie",
]);

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key)) {
      clean[key] = "[REDACTED]";
    } else if (typeof val === "string" && val.length > 300) {
      clean[key] = `${val.slice(0, 120)}... [truncated ${val.length} chars]`;
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "test" && level === "info") {
    return;
  }
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(sanitizeMeta(meta) ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export async function writeAuditLog(params: {
  actorId: string;
  actorRole: UserRole | "system";
  action: string;
  targetType: string;
  targetId: string;
  companyId?: string | null;
  reason?: string | null;
  previousState?: unknown;
  newState?: unknown;
  requestId?: string;
}): Promise<AuditLogRecord> {
  const record: AuditLogRecord = {
    id: `aud_${crypto.randomUUID().slice(0, 12)}`,
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    companyId: params.companyId ?? null,
    reason: params.reason ?? null,
    previousState: params.previousState,
    newState: params.newState,
    requestId: params.requestId,
    createdAt: new Date().toISOString(),
  };
  await db.auditLogs.insert(record);
  logEvent("info", "audit_recorded", {
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    actorRole: params.actorRole,
    requestId: params.requestId,
  });
  return record;
}
