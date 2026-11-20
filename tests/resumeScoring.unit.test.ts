import { describe, expect, it } from "vitest";
import {
  RESUME_CATEGORY_KEYS,
  RESUME_SCREENING_CONFIG,
  RESUME_WEIGHTS,
  type ResumeCategoryKey,
} from "../shared/constants";
import type { JobCriterion } from "../shared/types";
import {
  calculateWeightedScore,
  determineQualification,
  formatDisplayScore,
  paginateCombinedList,
  rankQualifiedApplications,
  validateCategoryScores,
  validateGeminiEvaluationPayload,
} from "../backend/src/services/atsScoring";

function buildValidCategoriesPayload(
  overrides: Partial<Record<ResumeCategoryKey, number>> = {},
  extra: {
    criterionId?: string;
    confidence?: "high" | "medium" | "low";
    reviewFlags?: string[];
  } = {}
) {
  const defaults: Record<ResumeCategoryKey, number> = {
    technicalSkillsMatch: 85,
    relevantWorkExperience: 80,
    projectsAndPracticalImplementation: 75,
    educationalQualifications: 80,
    resumePresentationAndReadability: 85,
    internshipsAndCertifications: 70,
    jobSpecificEligibility: 100,
  };
  const scores = { ...defaults, ...overrides };
  return {
    schemaVersion: "1.0" as const,
    categories: RESUME_CATEGORY_KEYS.map((category) => ({
      category,
      score: scores[category],
      evidence: [
        {
          description: `Evidence for ${category}`,
          excerpt: "Built distributed Go & TypeScript backend services",
          pageNumber: 1,
          extractionReference: "ext_ref_1",
          criterionId: extra.criterionId ?? "crit_1",
          evidenceStatus: "demonstrated" as const,
        },
      ],
      matchedCriteria: [extra.criterionId ?? "crit_1"],
      unmatchedCriteria: [],
      explanation: `Evaluation explanation for ${category}.`,
      confidence: extra.confidence ?? "high",
      limitations: [],
    })),
    overallObservations: ["Solid technical alignment."],
    reviewFlags: extra.reviewFlags ?? [],
  };
}

const SAMPLE_CRITERIA: JobCriterion[] = [
  {
    id: "crit_1",
    category: "technicalSkillsMatch",
    requirement: "Distributed Node.js/TypeScript or Go APIs",
    priority: "mandatory",
    sourceText: "Required Skills: TypeScript, Node.js, Go",
    evaluationGuidance: "Check production REST/RPC service ownership",
  },
];

describe("ResumeScoring_Rules.md — Fixed Weights & Deterministic Calculation", () => {
  it("enforces exact 7 categories summing to 100%", () => {
    expect(RESUME_CATEGORY_KEYS).toHaveLength(7);
    const total = RESUME_CATEGORY_KEYS.reduce((sum, key) => sum + RESUME_WEIGHTS[key], 0);
    expect(total).toBe(100);
    expect(RESUME_WEIGHTS).toEqual({
      technicalSkillsMatch: 30,
      relevantWorkExperience: 20,
      projectsAndPracticalImplementation: 15,
      educationalQualifications: 10,
      resumePresentationAndReadability: 10,
      internshipsAndCertifications: 5,
      jobSpecificEligibility: 10,
    });
  });

  it("enforces integer 0..100 bounds on every category score", () => {
    expect(() =>
      validateCategoryScores({
        technicalSkillsMatch: 80.5,
        relevantWorkExperience: 80,
        projectsAndPracticalImplementation: 80,
        educationalQualifications: 80,
        resumePresentationAndReadability: 80,
        internshipsAndCertifications: 80,
        jobSpecificEligibility: 80,
      })
    ).toThrow(/integer/i);

    expect(() =>
      validateCategoryScores({
        technicalSkillsMatch: -1,
        relevantWorkExperience: 80,
        projectsAndPracticalImplementation: 80,
        educationalQualifications: 80,
        resumePresentationAndReadability: 80,
        internshipsAndCertifications: 80,
        jobSpecificEligibility: 80,
      })
    ).toThrow(/0\.\.100/);

    expect(() =>
      validateCategoryScores({
        technicalSkillsMatch: 101,
        relevantWorkExperience: 80,
        projectsAndPracticalImplementation: 80,
        educationalQualifications: 80,
        resumePresentationAndReadability: 80,
        internshipsAndCertifications: 80,
        jobSpecificEligibility: 80,
      })
    ).toThrow(/0\.\.100/);
  });

  it("calculates exact backend weighted score from integer category scores", () => {
    const score = calculateWeightedScore({
      technicalSkillsMatch: 90, // 27.0
      relevantWorkExperience: 75, // 15.0
      projectsAndPracticalImplementation: 85, // 12.75
      educationalQualifications: 80, // 8.0
      resumePresentationAndReadability: 90, // 9.0
      internshipsAndCertifications: 70, // 3.5
      jobSpecificEligibility: 100, // 10.0
    });
    expect(score).toBeCloseTo(85.25, 6);
    expect(formatDisplayScore(score)).toBe("85.25");
  });

  it("applies exact 60.00% qualification threshold using unrounded score (never 80%)", () => {
    expect(RESUME_SCREENING_CONFIG.qualificationThreshold).toBe(60);
    expect(determineQualification(60)).toBe("qualified");
    expect(determineQualification(60.0)).toBe("qualified");
    expect(determineQualification(60.5)).toBe("qualified");
    expect(determineQualification(79.99)).toBe("qualified");
    expect(determineQualification(59.9999)).toBe("not_qualified");
    expect(determineQualification(59.99)).toBe("not_qualified");
    expect(formatDisplayScore(59.999)).toBe("60.00");
    // Unrounded 59.999 is not_qualified even if 2-decimal display shows 60.00
    expect(determineQualification(59.999)).toBe("not_qualified");
  });
});

describe("Gemini Payload Schema & Backend Authority Validation", () => {
  it("rejects AI-supplied weightedScore, qualified, isReferral, or ranking fields", () => {
    for (const forbidden of ["weightedScore", "qualified", "isReferral", "ranking", "rank"]) {
      const payload = { ...buildValidCategoriesPayload(), [forbidden]: 99 };
      const res = validateGeminiEvaluationPayload(payload, SAMPLE_CRITERIA);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toContain(forbidden);
      }
    }
  });

  it("rejects unknown criterionIds, missing categories, and duplicate categories", () => {
    const unknownCrit = validateGeminiEvaluationPayload(
      buildValidCategoriesPayload({}, { criterionId: "crit_does_not_exist" }),
      SAMPLE_CRITERIA
    );
    expect(unknownCrit.valid).toBe(false);

    const valid = buildValidCategoriesPayload();
    const missingCat = { ...valid, categories: valid.categories.slice(0, 6) };
    expect(validateGeminiEvaluationPayload(missingCat, SAMPLE_CRITERIA).valid).toBe(false);

    const dupCat = {
      ...valid,
      categories: [...valid.categories.slice(0, 6), valid.categories[0]],
    };
    expect(validateGeminiEvaluationPayload(dupCat, SAMPLE_CRITERIA).valid).toBe(false);
  });

  it("computes backend weighted score & triggers needsHumanReview on low confidence material category", () => {
    const res = validateGeminiEvaluationPayload(
      buildValidCategoriesPayload(
        {
          technicalSkillsMatch: 60,
          relevantWorkExperience: 60,
          projectsAndPracticalImplementation: 60,
          educationalQualifications: 60,
          resumePresentationAndReadability: 60,
          internshipsAndCertifications: 60,
          jobSpecificEligibility: 60,
        },
        { confidence: "low" }
      ),
      SAMPLE_CRITERIA
    );

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.weightedScore).toBe(60);
      expect(res.screeningResult).toBe("qualified");
      expect(res.needsHumanReview).toBe(true);
      expect(res.reviewReasons.length).toBeGreaterThan(0);
    }
  });
});

describe("ResumeScoring_Rules.md §6 — Referral-First Ranking Policy", () => {
  it("orders qualified referrals first (by score DESC), then qualified non-referrals (by score DESC) per §6.3 example", () => {
    const applicants = [
      { applicationId: "A", weightedScore: 96, qualified: true, isReferral: false, submittedAt: "2026-10-01T10:00:00Z" },
      { applicationId: "B", weightedScore: 82, qualified: true, isReferral: true, submittedAt: "2026-10-01T10:01:00Z" },
      { applicationId: "C", weightedScore: 91, qualified: true, isReferral: false, submittedAt: "2026-10-01T10:02:00Z" },
      { applicationId: "D", weightedScore: 74, qualified: true, isReferral: true, submittedAt: "2026-10-01T10:03:00Z" },
      { applicationId: "E", weightedScore: 88, qualified: true, isReferral: true, submittedAt: "2026-10-01T10:04:00Z" },
      { applicationId: "F_unqualified_ref", weightedScore: 59.5, qualified: false, isReferral: true, submittedAt: "2026-10-01T09:00:00Z" },
    ];

    const ranked = rankQualifiedApplications(applicants);
    expect(ranked.map((r) => r.applicationId)).toEqual(["E", "B", "D", "A", "C"]);
  });

  it("breaks ties deterministically via submittedAt ASC then applicationId ASC within the same referral group", () => {
    const ranked = rankQualifiedApplications([
      { applicationId: "app_z", weightedScore: 88, qualified: true, isReferral: false, submittedAt: "2026-10-01T12:00:00Z" },
      { applicationId: "app_b", weightedScore: 88, qualified: true, isReferral: false, submittedAt: "2026-10-01T11:00:00Z" },
      { applicationId: "app_a", weightedScore: 88, qualified: true, isReferral: false, submittedAt: "2026-10-01T11:00:00Z" },
    ]);
    expect(ranked.map((r) => r.applicationId)).toEqual(["app_a", "app_b", "app_z"]);
  });

  it("paginates the concatenated referral-first list without per-page global re-sorting", () => {
    const ordered = rankQualifiedApplications([
      { applicationId: "nonref_top", weightedScore: 99, qualified: true, isReferral: false, submittedAt: "2026-10-01T10:00:00Z" },
      { applicationId: "ref_high", weightedScore: 85, qualified: true, isReferral: true, submittedAt: "2026-10-01T10:01:00Z" },
      { applicationId: "ref_low", weightedScore: 62, qualified: true, isReferral: true, submittedAt: "2026-10-01T10:02:00Z" },
      { applicationId: "nonref_mid", weightedScore: 78, qualified: true, isReferral: false, submittedAt: "2026-10-01T10:03:00Z" },
    ]);

    const page1 = paginateCombinedList(ordered, 1, 2);
    const page2 = paginateCombinedList(ordered, 2, 2);

    expect(page1.items.map((i) => i.applicationId)).toEqual(["ref_high", "ref_low"]);
    expect(page2.items.map((i) => i.applicationId)).toEqual(["nonref_top", "nonref_mid"]);
  });
});
