import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { RESUME_CATEGORY_KEYS, type ResumeCategoryKey } from "../shared/constants";
import type { InterviewQuestion, InterviewReport } from "../shared/types";

// Mock only the external Gemini AI SDK wrapper so integration tests execute deterministically without live GEMINI_API_KEY
vi.mock("../backend/src/services/ai", () => {
  return {
    generateJobEvaluationProfileWithAI: vi.fn(async (job, actorId, nextVersion) => ({
      jobId: job.id,
      companyId: job.companyId,
      profileVersion: nextVersion,
      rubricVersion: "hz-rubric-v1",
      status: "ready",
      criteria: [
        {
          id: "crit_tech_1",
          category: "technicalSkillsMatch",
          description: `Core skills: ${(job.requiredSkills || ["TypeScript"]).join(", ")}`,
          mandatory: true,
          weightHint: 30,
        },
        {
          id: "crit_elig_1",
          category: "jobSpecificEligibility",
          description: "Meets explicit role eligibility",
          mandatory: true,
          weightHint: 10,
        },
      ],
      ambiguities: [],
      generatedByModel: "gemini-4-hydrogen",
      createdBy: actorId,
    })),
    evaluateResumeWithAI: vi.fn(async ({ profile }) => {
      const criterionId = profile.criteria[0]?.id || "crit_tech_1";
      const scores: Record<ResumeCategoryKey, number> = {
        technicalSkillsMatch: 85,
        relevantWorkExperience: 80,
        projectsAndPracticalImplementation: 80,
        educationalQualifications: 80,
        resumePresentationAndReadability: 85,
        internshipsAndCertifications: 70,
        jobSpecificEligibility: 90,
      };
      const categories = RESUME_CATEGORY_KEYS.map((category) => ({
        category,
        score: scores[category],
        evidence: [
          {
            description: `Demonstrated ${category}`,
            excerpt: "Backend systems in TypeScript & PostgreSQL",
            pageNumber: 1,
            extractionReference: "ext_test",
            criterionId,
            evidenceStatus: "demonstrated" as const,
          },
        ],
        matchedCriteria: [criterionId],
        unmatchedCriteria: [],
        explanation: `Strong evidence for ${category}.`,
        confidence: "high" as const,
        limitations: [],
      }));
      // 85*.3 + 80*.2 + 80*.15 + 80*.1 + 85*.1 + 70*.05 + 90*.1 = 25.5+16+12+8+8.5+3.5+9 = 82.5
      return {
        evaluation: {
          schemaVersion: "1.0" as const,
          categories,
          overallObservations: ["Strong backend match"],
          reviewFlags: [],
        },
        categoryScores: scores,
        weightedScore: 82.5,
        screeningResult: "qualified" as const,
        needsHumanReview: false,
        reviewReasons: [],
      };
    }),
    generateInterviewQuestionsWithAI: vi.fn(async (): Promise<InterviewQuestion[]> => [
      {
        id: "q_1",
        prompt: "Describe how you handle idempotent API writes at scale.",
        competency: "Distributed Systems",
        rubricSignals: ["Idempotency keys", "Database uniqueness"],
        expectedTimeMinutes: 10,
      },
      {
        id: "q_2",
        prompt: "Walk through debugging a slow PostgreSQL query under lock contention.",
        competency: "Database Performance",
        rubricSignals: ["EXPLAIN ANALYZE", "Lock monitoring"],
        expectedTimeMinutes: 10,
      },
      {
        id: "q_3",
        prompt: "How do you enforce multi-tenant RBAC across REST endpoints?",
        competency: "Security",
        rubricSignals: ["Tenant boundary", "Least privilege"],
        expectedTimeMinutes: 10,
      },
    ]),
    evaluateInterviewWithAI: vi.fn(async ({ session, atsWeightedScore }) => {
      const body: Omit<
        InterviewReport,
        "id" | "interviewId" | "applicationId" | "jobId" | "companyId" | "createdAt" | "updatedAt"
      > = {
        overallInterviewScore: 88.5,
        atsCumulativeScore: atsWeightedScore,
        targetLevelLabel: "Strong Senior Readiness",
        confidence: "high",
        dimensions: [
          {
            name: "Architecture & Reliability",
            score: 90,
            rubricTarget: 80,
            summary: "Clear idempotency strategy.",
          },
          {
            name: "Data & Persistence",
            score: 88,
            rubricTarget: 80,
            summary: "Strong query diagnostics.",
          },
          {
            name: "Security & Multi-Tenancy",
            score: 88,
            rubricTarget: 80,
            summary: "Proper server-side tenant assertions.",
          },
          {
            name: "Communication",
            score: 88,
            rubricTarget: 75,
            summary: "Concise written structure.",
          },
        ],
        synthesisSummary: "Candidate answered all scenarios clearly with production tradeoffs.",
        verifiedStrengths: ["Strong idempotency design", "Clear RBAC awareness"],
        recommendedDeepDive: "Ask about multi-region failover.",
        questionEvaluations: session.questions.map((q: InterviewQuestion) => ({
          questionId: q.id,
          questionPrompt: q.prompt,
          competency: q.competency,
          score: 89,
          rubricChecks: q.rubricSignals,
          evaluatorNote: "Solid architectural explanation.",
          evidenceFromAnswer: "Covered core signals directly.",
        })),
        model: "gemini-4-hydrogen",
        promptVersion: "interview-eval-v1",
      };
      return body;
    }),
  };
});

import { resolveMpaHtmlPath } from "../shared/mpaRoutes";
import { createApp } from "../backend/src/app";
import { db } from "../backend/src/db/database";
import { ensureSeedData } from "../backend/src/services/seed";

function buildValidPdfBuffer(bodyText: string): Buffer {
  const safe = bodyText.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = `BT /F1 11 Tf 50 740 Td (${safe}) Tj ET\n`;
  const objs = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}endstream endobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function buildEmptyScannedPdfBuffer(): Buffer {
  // Valid PDF structure with 1 blank page (0 readable characters)
  return buildValidPdfBuffer("");
}

const VALID_RESUME_BUFFER = buildValidPdfBuffer(
  "Senior Backend Engineer with 5 years experience in Node.js TypeScript PostgreSQL Redis Docker Kubernetes and distributed REST APIs. Led payment ledger services handling 10M daily events with 99.99% uptime."
);

describe("HireZilla Integration — PDF Validation, Security, Referral-First, Cap Concurrency & Interviews", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureSeedData();
  });

  it("blocks public signup from selecting admin role and enforces tenant isolation", async () => {
    const signupAgent = request.agent(app);
    const signupRes = await signupAgent
      .post("/api/auth/signup")
      .send({ email: "newuser@example.com", name: "New Candidate" });
    expect(signupRes.status).toBe(200);
    expect(signupRes.body.needsRoleSelection).toBe(true);

    // Attempt to self-assign admin role
    const adminAttempt = await signupAgent.post("/api/auth/role").send({ role: "admin" });
    expect(adminAttempt.status).toBe(400);

    // Legitimate role selection succeeds once
    const roleOk = await signupAgent.post("/api/auth/role").send({ role: "student" });
    expect(roleOk.status).toBe(200);
    expect(roleOk.body.user.role).toBe("student");

    // Cannot casually switch role after selection
    const roleSwitch = await signupAgent.post("/api/auth/role").send({ role: "recruiter" });
    expect(roleSwitch.status).toBe(409);

    // Logout and log back in with same email and empty string name (login page flow)
    await signupAgent.post("/api/auth/logout");
    const loginEmptyNameRes = await signupAgent
      .post("/api/auth/signup")
      .send({ email: "newuser@example.com", name: "" });
    expect(loginEmptyNameRes.status).toBe(200);
    expect(loginEmptyNameRes.body.user.email).toBe("newuser@example.com");
    expect(loginEmptyNameRes.body.user.role).toBe("student");
    expect(loginEmptyNameRes.body.needsRoleSelection).toBe(false);

    // Sign in using /login alias with email only
    const loginAliasRes = await signupAgent
      .post("/api/auth/login")
      .send({ email: "newuser@example.com" });
    expect(loginAliasRes.status).toBe(200);
    expect(loginAliasRes.body.user.email).toBe("newuser@example.com");

    // Invalid email rejection
    const invalidEmailRes = await signupAgent
      .post("/api/auth/signup")
      .send({ email: "not-an-email", name: "" });
    expect(invalidEmailRes.status).toBe(400);
    expect(invalidEmailRes.body.error).toBe("Please provide a valid email address.");

    // Invalid short name rejection
    const shortNameRes = await signupAgent
      .post("/api/auth/signup")
      .send({ email: "valid@example.com", name: "A" });
    expect(shortNameRes.status).toBe(400);
    expect(shortNameRes.body.error).toBe("Name must be at least 2 characters.");
  });

  it("enforces cross-tenant recruiter isolation & candidate score privacy", async () => {
    // Company B recruiter (Nimbus) tries to access Company A (CloudScale) job applicants & signed resume URL
    const nimbusAgent = request.agent(app);
    await nimbusAgent.post("/api/auth/demo-signin").send({ preset: "recruiter_nimbus" });

    const crossApps = await nimbusAgent.get("/api/jobs/job_backend_sr/applications");
    expect(crossApps.status).toBe(403);

    const crossEval = await nimbusAgent.get("/api/applications/app_rohan/resume-evaluation");
    expect(crossEval.status).toBe(403);

    const crossSignedUrl = await nimbusAgent.get("/api/resumes/res_app_rohan/signed-url");
    expect(crossSignedUrl.status).toBe(403);

    // Student cannot inspect recruiter-only category scores/evidence even for own application
    const studentAgent = request.agent(app);
    await studentAgent.post("/api/auth/demo-signin").send({ preset: "student_arjun" });

    const studentEvalView = await studentAgent.get(
      "/api/applications/app_arjun/resume-evaluation"
    );
    expect(studentEvalView.status).toBe(200);
    expect(studentEvalView.body.application.weightedScore).toBeUndefined();
    expect(studentEvalView.body.evaluation.categoryScores).toBeUndefined();

    // Student cannot fetch another student's resume signed URL
    const otherStudentResume = await studentAgent.get("/api/resumes/res_app_rohan/signed-url");
    expect(otherStudentResume.status).toBe(403);
  });

  it("verifies seeded ranked applicants follow referral-first policy", async () => {
    const priyaAgent = request.agent(app);
    await priyaAgent.post("/api/auth/demo-signin").send({ preset: "recruiter_priya" });

    const rankedRes = await priyaAgent.get(
      "/api/jobs/job_backend_sr/applications?screening=qualified"
    );
    expect(rankedRes.status).toBe(200);
    expect(rankedRes.body.rankingRule).toBe("referrals_then_non_referrals");
    const items = rankedRes.body.items as Array<{
      id: string;
      isReferral: boolean;
      weightedScore: number;
      screeningResult: string;
    }>;

    // Must contain only qualified candidates
    expect(items.every((i) => i.screeningResult === "qualified" && i.weightedScore >= 60)).toBe(true);

    // All referrals appear before any non-referral, even when non-referral score (96) > referral score (74)
    const firstNonRefIndex = items.findIndex((i) => !i.isReferral);
    expect(firstNonRefIndex).toBeGreaterThan(0);
    expect(items.slice(0, firstNonRefIndex).every((i) => i.isReferral)).toBe(true);
    expect(items.slice(firstNonRefIndex).every((i) => !i.isReferral)).toBe(true);
  });

  it("rejects non-PDF magic bytes and marks scanned/corrupt PDFs extraction_failed (never 0)", async () => {
    const priyaAgent = request.agent(app);
    await priyaAgent.post("/api/auth/demo-signin").send({ preset: "recruiter_priya" });

    // Create a fresh open job with profile ready for clean upload tests
    const jobRes = await priyaAgent.post("/api/recruiter/jobs").send({
      title: "Platform Engineer (PDF Test)",
      employmentType: "full_time",
      workMode: "remote",
      location: "Bengaluru",
      experienceLevel: "Mid-Level",
      summary: "Build reliable platform microservices and storage pipelines.",
      description:
        "Design resilient Node.js and TypeScript backend systems with strict PDF ingestion and auditability.",
      requiredSkills: ["TypeScript", "Node.js"],
      preferredSkills: ["MongoDB"],
    });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.job.id as string;

    await priyaAgent.post(`/api/jobs/${jobId}/evaluation-profile/generate`);
    await priyaAgent.post(`/api/recruiter/jobs/${jobId}/publish`);

    const stu1 = request.agent(app);
    await stu1.post("/api/auth/signup").send({ email: "fake_pdf_student@test.dev", name: "Fake PDF" });
    await stu1.post("/api/auth/role").send({ role: "student" });

    // 1. Renamed .txt -> .pdf rejected cleanly (400)
    const fakePdfRes = await stu1
      .post(`/api/jobs/${jobId}/apply`)
      .attach("resume", Buffer.from("NOT A REAL PDF FILE"), {
        filename: "malware.pdf",
        contentType: "application/pdf",
      });
    expect(fakePdfRes.status).toBe(400);
    expect(fakePdfRes.body.code).toBe("INVALID_PDF_SIGNATURE");

    // 2. Blank / scanned PDF -> stored, extraction_failed, screeningResult = not_determined (NEVER 0)
    const scannedRes = await stu1
      .post(`/api/jobs/${jobId}/apply`)
      .attach("resume", buildEmptyScannedPdfBuffer(), {
        filename: "scanned.pdf",
        contentType: "application/pdf",
      });
    expect(scannedRes.status).toBe(201);
    expect(scannedRes.body.resumeProcessingStatus).toBe("extraction_failed");

    const storedScannedApp = await db.applications.findById(scannedRes.body.application.id);
    expect(storedScannedApp?.screeningResult).toBe("not_determined");
    expect(storedScannedApp?.weightedScore).toBeNull();

    // 3. Invalid referral returns 422 with canContinueWithoutReferral, then continueWithoutReferral succeeds
    const stu2 = request.agent(app);
    await stu2.post("/api/auth/signup").send({ email: "ref_fallback@test.dev", name: "Ref Fallback" });
    await stu2.post("/api/auth/role").send({ role: "student" });

    const badRef = await stu2
      .post(`/api/jobs/${jobId}/apply`)
      .field("referralCode", "INVALID-999")
      .attach("resume", VALID_RESUME_BUFFER, {
        filename: "cv.pdf",
        contentType: "application/pdf",
      });
    expect(badRef.status).toBe(422);
    expect(badRef.body.canContinueWithoutReferral).toBe(true);

    const continueNoRef = await stu2
      .post(`/api/jobs/${jobId}/apply`)
      .field("referralCode", "INVALID-999")
      .field("continueWithoutReferral", "true")
      .attach("resume", VALID_RESUME_BUFFER, {
        filename: "cv.pdf",
        contentType: "application/pdf",
      });
    expect(continueNoRef.status).toBe(201);
    expect(continueNoRef.body.application.isReferral).toBe(false);

    // 4. Editing JD marks existing ready evaluation profile stale while preserving prior evaluations
    const patchRes = await priyaAgent
      .patch(`/api/recruiter/jobs/${jobId}`)
      .send({ requiredSkills: ["TypeScript", "Node.js", "Go"] });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.profileMarkedStale).toBe(true);
    expect(patchRes.body.job.evaluationProfileStatus).toBe("stale");
  });

  it("enforces Hatchling atomic 20-application cap under 22 concurrent submissions & blocks duplicate applies", async () => {
    const priyaAgent = request.agent(app);
    await priyaAgent.post("/api/auth/demo-signin").send({ preset: "recruiter_priya" });

    const jobRes = await priyaAgent.post("/api/recruiter/jobs").send({
      title: "Concurrency Cap Verification Role",
      employmentType: "full_time",
      workMode: "hybrid",
      location: "Bengaluru",
      experienceLevel: "Junior",
      summary: "Verify atomic Hatchling 20-applicant limit under parallel load.",
      description:
        "Role created to verify atomic concurrency cap and duplicate guard on Hatchling Free package.",
      requiredSkills: ["TypeScript"],
      preferredSkills: [],
    });
    const jobId = jobRes.body.job.id as string;
    await priyaAgent.post(`/api/jobs/${jobId}/evaluation-profile/generate`);
    await priyaAgent.post(`/api/recruiter/jobs/${jobId}/publish`);

    // Provision 22 distinct authenticated student agents
    const studentAgents = await Promise.all(
      Array.from({ length: 22 }, async (_, idx) => {
        const ag = request.agent(app);
        await ag
          .post("/api/auth/signup")
          .send({ email: `cap_student_${idx}@test.dev`, name: `Cap Student ${idx}` });
        await ag.post("/api/auth/role").send({ role: "student" });
        return ag;
      })
    );

    // Fire 22 concurrent applications simultaneously
    const responses = await Promise.all(
      studentAgents.map((ag) =>
        ag
          .post(`/api/jobs/${jobId}/apply`)
          .attach("resume", VALID_RESUME_BUFFER, {
            filename: "resume.pdf",
            contentType: "application/pdf",
          })
      )
    );

    const successes = responses.filter((r) => r.status === 201);
    const capRejects = responses.filter(
      (r) => r.status === 409 && r.body.code === "JOB_CAP_REACHED"
    );
    expect(successes).toHaveLength(20);
    expect(capRejects).toHaveLength(2);

    const jobAfter = await db.jobs.findById(jobId);
    expect(jobAfter?.applicationCount).toBe(20);

    // Also verify duplicate application rejection for same student on a fresh job
    const job2Res = await priyaAgent.post("/api/recruiter/jobs").send({
      title: "Duplicate Guard Role",
      employmentType: "full_time",
      workMode: "remote",
      location: "Remote",
      experienceLevel: "Mid",
      summary: "Verify duplicate candidate application guard.",
      description: "Verify one candidate cannot submit multiple applications to the same role.",
      requiredSkills: ["TypeScript"],
    });
    const job2Id = job2Res.body.job.id as string;
    await priyaAgent.post(`/api/jobs/${job2Id}/evaluation-profile/generate`);
    await priyaAgent.post(`/api/recruiter/jobs/${job2Id}/publish`);

    const first = await studentAgents[0]
      .post(`/api/jobs/${job2Id}/apply`)
      .attach("resume", VALID_RESUME_BUFFER, {
        filename: "first.pdf",
        contentType: "application/pdf",
      });
    expect(first.status).toBe(201);

    const duplicate = await studentAgents[0]
      .post(`/api/jobs/${job2Id}/apply`)
      .attach("resume", VALID_RESUME_BUFFER, {
        filename: "second.pdf",
        contentType: "application/pdf",
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("DUPLICATE_APPLICATION");
  });

  it("handles tie review protected-attribute rejection, interview invite, idempotent submit, and report scoring", async () => {
    const priyaAgent = request.agent(app);
    await priyaAgent.post("/api/auth/demo-signin").send({ preset: "recruiter_priya" });

    // 1. Tie review protected attribute / referral-only rejection
    const badTie = await priyaAgent
      .post("/api/jobs/job_backend_sr/ties/score_96/resolve")
      .send({
        outcome: "selected_one",
        selectedApplicationIds: ["app_rohan"],
        reasonCode: "other_job_related_reason",
        note: "Prefer candidate due to referral and age.",
      });
    expect(badTie.status).toBe(400);

    // Valid job-related tie resolution succeeds & persists TieResolutionRecord
    const okTie = await priyaAgent
      .post("/api/jobs/job_backend_sr/ties/score_96/resolve")
      .send({
        outcome: "progress_both",
        selectedApplicationIds: [],
        reasonCode: "relevant_project_complexity",
        note: "Both demonstrate verified distributed consensus implementation.",
      });
    expect(okTie.status).toBe(200);
    expect(okTie.body.resolution.outcome).toBe("progress_both");

    // 2. Publish interview question set & invite Elena
    const qSetRes = await priyaAgent
      .put("/api/recruiter/jobs/job_backend_sr/interview-setup")
      .send({
        status: "published",
        durationMinutes: 45,
        questions: [
          {
            id: "iq_1",
            prompt: "Explain how you would design an idempotent webhook ingestion worker.",
            competency: "Reliability",
            rubricSignals: ["Deduplication key", "DLQ handling"],
            expectedTimeMinutes: 15,
          },
          {
            id: "iq_2",
            prompt: "How do you diagnose tail latency spikes in a Go/Node RPC service?",
            competency: "Observability",
            rubricSignals: ["p99 tracing", "Connection pool limits"],
            expectedTimeMinutes: 15,
          },
          {
            id: "iq_3",
            prompt: "Walk through tenant authorization checks for sensitive candidate PDFs.",
            competency: "Security",
            rubricSignals: ["Signed URL TTL", "Tenant verification"],
            expectedTimeMinutes: 15,
          },
        ],
      });
    expect(qSetRes.status).toBe(200);

    const inviteRes = await priyaAgent
      .post("/api/recruiter/jobs/job_backend_sr/interviews/invite")
      .send({
        applicationIds: ["app_elena"],
        deadlineAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        durationMinutes: 45,
      });
    expect(inviteRes.status).toBe(201);
    const token = inviteRes.body.invitations[0].token as string;
    expect(token).toMatch(/^HZ-INT-/);

    // Candidate starts, autosaves, and submits twice (second submit is idempotent)
    const startRes = await request(app).post(`/api/interviews/token/${token}/start`);
    expect(startRes.status).toBe(200);

    const saveRes = await request(app)
      .put(`/api/interviews/token/${token}/answers`)
      .send({
        questionId: "iq_1",
        answerText: "Use unique idempotency keys stored atomically with exponential backoff and DLQ.",
      });
    expect(saveRes.status).toBe(200);

    const submit1 = await request(app)
      .post(`/api/interviews/token/${token}/submit`)
      .send({
        answers: [
          {
            questionId: "iq_2",
            answerText: "Inspect distributed traces for GC pauses, downstream DB locks, and pool saturation.",
          },
          {
            questionId: "iq_3",
            answerText: "Validate company ownership on every request and serve PDFs via short-lived HMAC tokens.",
          },
        ],
      });
    expect(submit1.status).toBe(200);
    expect(submit1.body.alreadySubmitted).toBe(false);
    expect(submit1.body.session.status).toBe("report_ready");

    const submit2 = await request(app).post(`/api/interviews/token/${token}/submit`).send({});
    expect(submit2.status).toBe(200);
    expect(submit2.body.alreadySubmitted).toBe(true);

    // Recruiter fetches interview report and records final decision
    const repRes = await priyaAgent.get(
      "/api/recruiter/applications/app_elena/interview-report"
    );
    expect(repRes.status).toBe(200);
    expect(repRes.body.report.overallInterviewScore).toBe(88.5);

    const decRes = await priyaAgent
      .post("/api/recruiter/applications/app_elena/interview-report/decision")
      .send({
        recommendation: "strong",
        notes: "Ready for final engineering panel.",
        action: "advance_panel",
      });
    expect(decRes.status).toBe(200);
    expect(decRes.body.application.recruiterDecision).toBe("selected");
  });

  it("supports decoupled AWS cross-origin CORS + Bearer token auth and backend dashboard aggregations", async () => {
    // 1. Verify CORS headers for an allowed localhost/frontend origin & Bearer token flow (no cookies)
    const loginRes = await request(app)
      .post("/api/auth/demo-signin")
      .set("Origin", "http://localhost:5173")
      .send({ preset: "recruiter_priya" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(loginRes.headers["access-control-allow-credentials"]).toBe("true");
    const bearerToken = loginRes.body.token as string;
    expect(typeof bearerToken).toBe("string");
    expect(bearerToken.length).toBeGreaterThan(20);

    // 2. Call recruiter dashboard aggregation purely with Authorization: Bearer <token>
    const recDash = await request(app)
      .get("/api/recruiter/dashboard")
      .set("Origin", "http://localhost:5173")
      .set("Authorization", `Bearer ${bearerToken}`);
    expect(recDash.status).toBe(200);
    expect(recDash.body.company?.id).toBe("cmp_cloudscale");
    expect(Array.isArray(recDash.body.jobs)).toBe(true);
    expect(recDash.body.stats.activeJobs).toBeGreaterThanOrEqual(1);
    expect(typeof recDash.body.stats.qualifiedApplicants).toBe("number");

    // 3. Verify student dashboard aggregation with Bearer token
    const stuLogin = await request(app)
      .post("/api/auth/demo-signin")
      .send({ preset: "student_arjun" });
    const stuToken = stuLogin.body.token as string;

    const stuDash = await request(app)
      .get("/api/student/dashboard")
      .set("Authorization", `Bearer ${stuToken}`);
    expect(stuDash.status).toBe(200);
    expect(stuDash.body.portfolio?.slug).toBe("arjun-mehta");
    expect(stuDash.body.portfolioCompleteness.totalSteps).toBe(5);
    expect(stuDash.body.counts.submitted).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(stuDash.body.applications)).toBe(true);
  });

  it("resolves distinct MPA HTML documents per route and rejects unknown routes (non-SPA)", () => {
    expect(resolveMpaHtmlPath("/")).toBe("/index.html");
    expect(resolveMpaHtmlPath("/jobs")).toBe("/jobs/index.html");
    expect(resolveMpaHtmlPath("/jobs/job_backend_sr")).toBe("/jobs/detail/index.html");
    expect(resolveMpaHtmlPath("/jobs/job_backend_sr/apply")).toBe("/jobs/apply/index.html");
    expect(resolveMpaHtmlPath("/p/arjun-mehta")).toBe("/p/index.html");
    expect(resolveMpaHtmlPath("/recruiter/jobs/job_backend_sr/applicants")).toBe(
      "/recruiter/jobs/applicants/index.html"
    );
    expect(resolveMpaHtmlPath("/recruiter/applications/app_rohan/interview-report")).toBe(
      "/recruiter/applications/interview-report/index.html"
    );
    // Non-SPA guarantee: unknown routes must NOT fall back to /index.html
    expect(resolveMpaHtmlPath("/does-not-exist")).toBeNull();
    expect(resolveMpaHtmlPath("/api/health")).toBeNull();
  });
});

