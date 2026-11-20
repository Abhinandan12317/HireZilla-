import crypto from "crypto";
import type { NotificationEmailRecord } from "../../../shared/types";
import { db } from "../db/database";
import { logEvent } from "./audit";

export async function sendPlatformEmail(params: {
  toEmail: string;
  toName: string;
  subject: string;
  bodyText: string;
  templateType: NotificationEmailRecord["templateType"];
  relatedApplicationId?: string;
  relatedInterviewId?: string;
  simulateFailure?: boolean;
}): Promise<NotificationEmailRecord> {
  const record: NotificationEmailRecord = {
    id: `eml_${crypto.randomUUID().slice(0, 12)}`,
    toEmail: params.toEmail,
    toName: params.toName,
    subject: params.subject,
    bodyText: `${params.bodyText}\n\n—\nHireZilla — The monster of hiring`,
    templateType: params.templateType,
    relatedApplicationId: params.relatedApplicationId,
    relatedInterviewId: params.relatedInterviewId,
    status: params.simulateFailure ? "failed" : "sent_dev_outbox",
    errorMessage: params.simulateFailure
      ? "Development email adapter simulated delivery failure."
      : null,
    createdAt: new Date().toISOString(),
  };

  await db.notifications.insert(record);
  logEvent(params.simulateFailure ? "warn" : "info", "dev_email_outbox", {
    emailId: record.id,
    templateType: record.templateType,
    status: record.status,
    relatedApplicationId: record.relatedApplicationId,
  });

  return record;
}
