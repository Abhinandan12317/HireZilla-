import { z } from "zod";
import {
  RESUME_CATEGORY_KEYS,
  RESUME_SCREENING_CONFIG,
  RESUME_WEIGHTS,
  type ResumeCategoryKey,
} from "../../../shared/constants";
import type {
  ApplicationRecord,
  CategoryEvaluation,
  JobCriterion,
  ScreeningResult,
} from "../../../shared/types";

export const EvidenceItemSchema = z.object({
  description: z.string().min(1),
  excerpt: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  extractionReference: z.string().optional(),
  criterionId: z.string().optional(),
  evidenceStatus: z.enum([
    "demonstrated",
    "not_demonstrated",
    "unclear",
    "not_applicable",
  ]),
});

export const CategoryEvaluationSchema = z.object({
  category: z.enum(RESUME_CATEGORY_KEYS),
  score: z.number().int().min(0).max(100),
  evidence: z.array(EvidenceItemSchema).min(1),
  matchedCriteria: z.array(z.string()),
  unmatchedCriteria: z.array(z.string()),
  explanation: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  limitations: z.array(z.string()),
});

export const GeminiResumeEvaluationSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    categories: z.array(CategoryEvaluationSchema).length(RESUME_CATEGORY_KEYS.length),
    overallObservations: z.array(z.string()),
    reviewFlags: z.array(z.string()),
  })
  .strict();

export type ValidatedGeminiEvaluation = z.infer<typeof GeminiResumeEvaluationSchema>;

export function validateCategoryScores(
  scores: Record<string, unknown>
): Record<ResumeCategoryKey, number> {
  const result = {} as Record<ResumeCategoryKey, number>;
  for (const key of RESUME_CATEGORY_KEYS) {
    const val = scores[key];
    if (typeof val !== "number" || !Number.isInteger(val) || val < 0 || val > 100) {
      throw new Error(
        `Invalid category score for ${key}: expected integer 0..100, got ${String(val)}`
      );
    }
    result[key] = val;
  }
  return result;
}

export function calculateWeightedScore(
  scores: Record<ResumeCategoryKey, number>
): number {
  const validated = validateCategoryScores(scores);
  let total = 0;
  for (const key of RESUME_CATEGORY_KEYS) {
    total += (validated[key] * RESUME_WEIGHTS[key]) / 100;
  }
  return total;
}

export function formatDisplayScore(unroundedScore: number): string {
  return unroundedScore.toFixed(RESUME_SCREENING_CONFIG.displayDecimalPlaces);
}

export function determineQualification(
  unroundedWeightedScore: number,
  threshold: number = RESUME_SCREENING_CONFIG.qualificationThreshold
): Exclude<ScreeningResult, "not_determined"> {
  return unroundedWeightedScore >= threshold ? "qualified" : "not_qualified";
}

export function validateGeminiEvaluationPayload(
  rawPayload: unknown,
  validJobCriteria: JobCriterion[]
): {
  valid: true;
  evaluation: ValidatedGeminiEvaluation;
  categoryScores: Record<ResumeCategoryKey, number>;
  weightedScore: number;
  screeningResult: Exclude<ScreeningResult, "not_determined">;
  needsHumanReview: boolean;
  reviewReasons: string[];
} | {
  valid: false;
  error: string;
} {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return { valid: false, error: "Evaluation response is not a JSON object." };
  }

  const obj = rawPayload as Record<string, unknown>;
  // Explicitly reject if AI tried to supply weightedScore, qualified, isReferral, or ranking
  for (const forbidden of ["weightedScore", "qualified", "isReferral", "ranking", "rank"]) {
    if (forbidden in obj) {
      return {
        valid: false,
        error: `Gemini output illegally contained backend-controlled field "${forbidden}".`,
      };
    }
  }

  const parsed = GeminiResumeEvaluationSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      valid: false,
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  const seenCategories = new Set<ResumeCategoryKey>();
  const categoryScores = {} as Record<ResumeCategoryKey, number>;
  const validCriterionIds = new Set(validJobCriteria.map((c) => c.id));

  for (const cat of parsed.data.categories) {
    if (seenCategories.has(cat.category)) {
      return {
        valid: false,
        error: `Duplicate category in evaluation output: ${cat.category}`,
      };
    }
    seenCategories.add(cat.category);
    categoryScores[cat.category] = cat.score;

    for (const cid of [...cat.matchedCriteria, ...cat.unmatchedCriteria]) {
      if (!validCriterionIds.has(cid)) {
        return {
          valid: false,
          error: `Unknown criterionId "${cid}" referenced in category ${cat.category}.`,
        };
      }
    }
    for (const ev of cat.evidence) {
      if (ev.criterionId && !validCriterionIds.has(ev.criterionId)) {
        return {
          valid: false,
          error: `Unknown criterionId "${ev.criterionId}" in evidence of ${cat.category}.`,
        };
      }
    }
  }

  for (const reqKey of RESUME_CATEGORY_KEYS) {
    if (!seenCategories.has(reqKey)) {
      return { valid: false, error: `Missing required category: ${reqKey}` };
    }
  }

  const weightedScore = calculateWeightedScore(categoryScores);
  const screeningResult = determineQualification(weightedScore);

  const reviewReasons: string[] = [...parsed.data.reviewFlags];
  const lowConfidenceMaterial = parsed.data.categories.filter(
    (c) =>
      c.confidence === "low" &&
      (RESUME_WEIGHTS[c.category] >= 10 || c.category === "jobSpecificEligibility")
  );
  if (lowConfidenceMaterial.length > 0) {
    reviewReasons.push(
      `Low model confidence on: ${lowConfidenceMaterial.map((c) => c.category).join(", ")}`
    );
  }

  return {
    valid: true,
    evaluation: parsed.data,
    categoryScores,
    weightedScore,
    screeningResult,
    needsHumanReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

export interface RankableApplication {
  applicationId: string;
  weightedScore: number;
  qualified: boolean;
  isReferral: boolean;
  submittedAt: Date | string;
}

/**
 * Authoritative ResumeScreening_Rules.md Section 6.1 ranking sequence:
 * 1. Exclude unqualified candidates from the qualified view.
 * 2. Separate qualified applicants into referral and non-referral groups.
 * 3. Sort referrals by weightedScore DESC, submittedAt ASC, applicationId ASC.
 * 4. Sort non-referrals by weightedScore DESC, submittedAt ASC, applicationId ASC.
 * 5. Concatenate referrals first, non-referrals second — NEVER globally re-sort afterward.
 */
export function rankQualifiedApplications<T extends RankableApplication>(items: T[]): T[] {
  const qualified = items.filter((item) => item.qualified);

  const sortByScoreDesc = (a: T, b: T) => {
    const scoreDiff = b.weightedScore - a.weightedScore;
    if (scoreDiff !== 0) return scoreDiff;
    const tA = new Date(a.submittedAt).getTime();
    const tB = new Date(b.submittedAt).getTime();
    if (tA !== tB) return tA - tB;
    return a.applicationId.localeCompare(b.applicationId);
  };

  const referrals = qualified.filter((i) => i.isReferral).sort(sortByScoreDesc);
  const nonReferrals = qualified.filter((i) => !i.isReferral).sort(sortByScoreDesc);

  return [...referrals, ...nonReferrals];
}

export function rankApplicationRecords(records: ApplicationRecord[]): {
  referrals: ApplicationRecord[];
  nonReferrals: ApplicationRecord[];
  combined: ApplicationRecord[];
} {
  const eligible = records.filter(
    (r) =>
      r.screeningResult === "qualified" &&
      typeof r.weightedScore === "number" &&
      (r.evaluationStatus === "completed" || r.evaluationStatus === "needs_review")
  );

  const sortFn = (a: ApplicationRecord, b: ApplicationRecord) => {
    const scoreDiff = (b.weightedScore ?? 0) - (a.weightedScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    const tA = new Date(a.submittedAt).getTime();
    const tB = new Date(b.submittedAt).getTime();
    if (tA !== tB) return tA - tB;
    return a.id.localeCompare(b.id);
  };

  const referrals = eligible.filter((r) => r.isReferral).sort(sortFn);
  const nonReferrals = eligible.filter((r) => !r.isReferral).sort(sortFn);

  return {
    referrals,
    nonReferrals,
    combined: [...referrals, ...nonReferrals],
  };
}

export function detectExactTies(records: ApplicationRecord[]): Array<{
  tieGroupKey: string;
  weightedScore: number;
  applications: ApplicationRecord[];
}> {
  const qualified = records.filter(
    (r) =>
      r.screeningResult === "qualified" &&
      typeof r.weightedScore === "number" &&
      (r.evaluationStatus === "completed" || r.evaluationStatus === "needs_review")
  );
  const byScore = new Map<number, ApplicationRecord[]>();
  for (const app of qualified) {
    const score = app.weightedScore!;
    const arr = byScore.get(score) ?? [];
    arr.push(app);
    byScore.set(score, arr);
  }
  const ties: Array<{
    tieGroupKey: string;
    weightedScore: number;
    applications: ApplicationRecord[];
  }> = [];
  for (const [score, apps] of byScore.entries()) {
    if (apps.length >= 2) {
      ties.push({
        tieGroupKey: `score_${score}`,
        weightedScore: score,
        applications: apps,
      });
    }
  }
  return ties.sort((a, b) => b.weightedScore - a.weightedScore);
}

export function paginateCombinedList<T>(
  orderedItems: T[],
  page: number,
  limit: number
): { items: T[]; total: number; page: number; limit: number; totalPages: number } {
  const safePage = Math.max(1, Math.floor(page || 1));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit || 20)));
  const start = (safePage - 1) * safeLimit;
  return {
    items: orderedItems.slice(start, start + safeLimit),
    total: orderedItems.length,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(orderedItems.length / safeLimit)),
  };
}

export type { CategoryEvaluation };
