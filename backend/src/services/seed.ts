import { RESUME_CATEGORY_KEYS, RESUME_SCREENING_CONFIG } from "../../../shared/constants";
import type {
  ApplicationRecord,
  AuthUser,
  Company,
  InterviewQuestionSet,
  InterviewReport,
  InterviewSession,
  JobEvaluationProfile,
  JobPosting,
  ReferralTokenRecord,
  ReportFlagRecord,
  ResumeEvaluationRecord,
  ResumeFileRecord,
  StudentPortfolio,
} from "../../../shared/types";
import { db } from "../db/database";
import { calculateWeightedScore } from "./atsScoring";
import { storePrivateResumeFile } from "./pdfProcessor";

function buildMinimalPdfBuffer(title: string, bodyLines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const lines = [title, ...bodyLines];
  const textOps = lines
    .map((line, i) => `BT /F1 11 Tf 50 ${750 - i * 18} Td (${esc(line)}) Tj ET`)
    .join("\n");
  const stream = `${textOps}\n`;
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
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

export async function ensureSeedData(): Promise<void> {
  const existingUsers = await db.users.findAll();
  if (existingUsers.length > 0) {
    return;
  }

  const now = new Date("2026-10-20T09:00:00.000Z").toISOString();

  // 1. Users
  const users: AuthUser[] = [
    {
      id: "usr_recruiter_priya",
      email: "priya.sharma@cloudscale.demo",
      name: "Priya Sharma",
      role: "recruiter",
      status: "active",
      companyId: "cmp_cloudscale",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_recruiter_nimbus",
      email: "aravind@nimbus.demo",
      name: "Aravind Rao",
      role: "recruiter",
      status: "active",
      companyId: "cmp_nimbus",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_student_arjun",
      email: "arjun.mehta@iitd.demo",
      name: "Arjun Mehta",
      role: "student",
      status: "active",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_student_elena",
      email: "elena.rostova@demo.hirezilla",
      name: "Elena Rostova",
      role: "student",
      status: "active",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_student_vikram",
      email: "vikram.nair@demo.hirezilla",
      name: "Vikram Nair",
      role: "student",
      status: "active",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_student_sneha",
      email: "sneha.kulkarni@demo.hirezilla",
      name: "Sneha Kulkarni",
      role: "student",
      status: "active",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_student_rohan",
      email: "rohan.verma@demo.hirezilla",
      name: "Rohan Verma",
      role: "student",
      status: "active",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_student_meera",
      email: "meera.iyer@demo.hirezilla",
      name: "Meera Iyer",
      role: "student",
      status: "active",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_student_kabir",
      email: "kabir.joshi@demo.hirezilla",
      name: "Kabir Joshi",
      role: "student",
      status: "active",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_student_neha",
      email: "neha.patel@demo.hirezilla",
      name: "Neha Patel",
      role: "student",
      status: "active",
      isDemo: true,
      createdAt: now,
    },
    {
      id: "usr_admin_root",
      email: "admin@hirezilla.local",
      name: "HireZilla Trust & Safety Admin",
      role: "admin",
      status: "active",
      isDemo: true,
      createdAt: now,
    },
  ];
  for (const u of users) await db.users.insert(u);

  // 2. Companies (All Not verified in MVP)
  const companies: Company[] = [
    {
      id: "cmp_cloudscale",
      name: "CloudScale Labs",
      website: "https://cloudscalelabs.example",
      industry: "Cloud Infrastructure & Distributed Systems",
      size: "51-200",
      location: "Bengaluru, India",
      description:
        "Building ultra-low-latency ingestion pipelines, distributed consensus storage, and developer observability tooling.",
      ownerUserId: "usr_recruiter_priya",
      memberUserIds: ["usr_recruiter_priya"],
      status: "active",
      verificationStatus: "not_verified",
      packageCode: "HATCHLING_FREE",
      packageActivatedAt: now,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "cmp_nimbus",
      name: "Nimbus FinTech",
      website: "https://nimbusfintech.example",
      industry: "Financial Infrastructure",
      size: "201-500",
      location: "Mumbai, India",
      description:
        "Real-time ledger reconciliation and ML risk scoring infrastructure for high-throughput payment rails.",
      ownerUserId: "usr_recruiter_nimbus",
      memberUserIds: ["usr_recruiter_nimbus"],
      status: "active",
      verificationStatus: "not_verified",
      packageCode: "HATCHLING_FREE",
      packageActivatedAt: now,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const c of companies) await db.companies.insert(c);

  // 3. Portfolios
  const arjunPortfolio: StudentPortfolio = {
    id: "prt_arjun_mehta",
    userId: "usr_student_arjun",
    slug: "arjun-mehta",
    displayName: "Arjun Mehta",
    email: "arjun.mehta@iitd.demo",
    headline: "Senior Backend & Distributed Systems Engineer · Go, FastAPI, Raft",
    phone: "+91-98100-00001",
    location: "Bengaluru, India",
    summary:
      "Backend engineer focused on high-throughput Go and Python services, Raft consensus engines, gRPC backpressure control, and Linux kernel network diagnostics.",
    education: [
      {
        id: "edu_1",
        institution: "Indian Institute of Technology Delhi",
        qualification: "B.Tech",
        fieldOfStudy: "Computer Science & Engineering",
        startYear: 2018,
        endYear: 2022,
        status: "completed",
        coursework: "Distributed Systems, Operating Systems, Database Internals",
      },
    ],
    skills: [
      { name: "Go", selfRating: "advanced" },
      { name: "Python / FastAPI", selfRating: "advanced" },
      { name: "Distributed Systems", selfRating: "advanced" },
      { name: "gRPC & HTTP/2", selfRating: "advanced" },
      { name: "Kubernetes", selfRating: "intermediate" },
      { name: "PostgreSQL", selfRating: "advanced" },
      { name: "Redis", selfRating: "advanced" },
    ],
    projects: [
      {
        id: "proj_raft",
        title: "raft-kv-core",
        description:
          "Fault-tolerant distributed key-value store implementing Raft pre-vote consensus, log compaction snapshots, and lock-free circular ring-buffer ingestion.",
        roleContribution:
          "Sole author; engineered buffer/ring.go backpressure path and chaos network partition suite.",
        technologies: ["Go", "gRPC", "Raft", "BoltDB"],
        githubUrl: "https://github.com/arjunmehta/raft-kv-core",
      },
      {
        id: "proj_stream",
        title: "telemetry-edge-gateway",
        description:
          "FastAPI + async worker ingestion proxy sustaining 85k events/sec with Redis lease locks and Prometheus pprof exporters.",
        roleContribution:
          "Architected async batch flushers and circuit-breaker fallback queues.",
        technologies: ["Python", "FastAPI", "Redis", "Docker"],
        githubUrl: "https://github.com/arjunmehta/telemetry-edge-gateway",
      },
    ],
    links: {
      github: "https://github.com/arjunmehta",
      linkedin: "https://linkedin.com/in/arjunmehta-demo",
      website: "https://arjunmehta.dev",
    },
    certifications: [
      {
        id: "cert_ckad",
        name: "Certified Kubernetes Application Developer (CKAD)",
        issuer: "CNCF",
        date: "2024-03",
      },
    ],
    visibility: "public",
    onboardingCompleted: true,
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.portfolios.insert(arjunPortfolio);

  // 4. Jobs
  const jobs: JobPosting[] = [
    {
      id: "job_backend_sr",
      companyId: "cmp_cloudscale",
      companyName: "CloudScale Labs",
      companyVerificationStatus: "not_verified",
      title: "Senior Backend Engineer (FastAPI / Distributed Systems)",
      department: "Core Infrastructure",
      employmentType: "full_time",
      workMode: "hybrid",
      location: "Bengaluru, India",
      experienceLevel: "3–6 years",
      experienceYearsMin: 3,
      experienceYearsMax: 6,
      educationRequirement: "B.Tech / B.E. in Computer Science or equivalent practical systems background",
      eligibilityRequirements: [
        "Authorized to work in India",
        "Available to work hybrid in Bengaluru (3 days/week)",
      ],
      summary:
        "Design resilient distributed ingestion services, backpressure-aware gRPC/FastAPI pipelines, and partitioned storage systems.",
      description:
        "CloudScale Labs is hiring a Senior Backend Engineer to own core distributed systems services written in Python (FastAPI) and Go. You will diagnose production tail-latency issues, design fault-tolerant caching and consensus workflows, and mentor junior engineers.",
      responsibilities: [
        "Architect and operate high-throughput FastAPI and Go gRPC microservices",
        "Implement Redis distributed locking, singleflight caching, and graceful degradation",
        "Debug production concurrency, memory contention, and network bottlenecks",
      ],
      requiredSkills: ["Python", "FastAPI", "Distributed Systems", "PostgreSQL", "Redis"],
      preferredSkills: ["Go", "gRPC", "Kubernetes", "Prometheus"],
      compensationDisplay: "₹32L – ₹46L / year",
      applicationCap: 20,
      applicationCount: 8,
      status: "open",
      activeEvaluationProfileId: "prof_backend_v1",
      activeEvaluationProfileVersion: "1",
      evaluationProfileStatus: "ready",
      closingDate: "2026-12-31T23:59:59.000Z",
      isDemo: true,
      createdBy: "usr_recruiter_priya",
      createdAt: "2026-10-15T08:00:00.000Z",
      updatedAt: now,
    },
    {
      id: "job_ml_eng",
      companyId: "cmp_cloudscale",
      companyName: "CloudScale Labs",
      companyVerificationStatus: "not_verified",
      title: "Applied ML Infrastructure Engineer",
      department: "AI Platform",
      employmentType: "full_time",
      workMode: "remote",
      location: "Remote (India)",
      experienceLevel: "2–4 years",
      experienceYearsMin: 2,
      experienceYearsMax: 4,
      educationRequirement: "Bachelor's degree in CS, Statistics, or related engineering discipline",
      eligibilityRequirements: ["Remote within India timezone overlap (IST)"],
      summary:
        "Build low-latency inference routers, structured evaluation pipelines, and observability tooling for LLM workflows.",
      description:
        "Join our AI Platform team to productionize inference pipelines, structured JSON schema validators, vector retrieval indices, and latency monitoring.",
      responsibilities: [
        "Build Python inference orchestration with deterministic validation",
        "Optimize batching, embedding indexing, and evaluation harness pipelines",
      ],
      requiredSkills: ["Python", "PyTorch", "FastAPI", "Docker", "Vector Search"],
      preferredSkills: ["Kubernetes", "ONNX", "Redis"],
      compensationDisplay: "₹26L – ₹38L / year",
      applicationCap: 20,
      applicationCount: 0,
      status: "open",
      activeEvaluationProfileId: "prof_ml_v1",
      activeEvaluationProfileVersion: "1",
      evaluationProfileStatus: "ready",
      closingDate: "2026-12-20T23:59:59.000Z",
      isDemo: true,
      createdBy: "usr_recruiter_priya",
      createdAt: "2026-10-17T08:00:00.000Z",
      updatedAt: now,
    },
    {
      id: "job_nimbus_fe",
      companyId: "cmp_nimbus",
      companyName: "Nimbus FinTech",
      companyVerificationStatus: "not_verified",
      title: "Frontend Platform Engineer (React / TypeScript)",
      department: "Merchant Experience",
      employmentType: "full_time",
      workMode: "hybrid",
      location: "Mumbai, India",
      experienceLevel: "1–3 years",
      experienceYearsMin: 1,
      experienceYearsMax: 3,
      educationRequirement: "Any graduate or equivalent portfolio experience",
      eligibilityRequirements: ["Able to work hybrid from Mumbai"],
      summary:
        "Craft accessible, high-density merchant reconciliation tables and real-time payout dashboards.",
      description:
        "Build crisp TypeScript & React financial consoles with strict accessibility, tabular numeric precision, and zero-jank performance.",
      responsibilities: [
        "Own core React + TypeScript design system tables and state charts",
        "Collaborate with backend ledger teams on API contract reliability",
      ],
      requiredSkills: ["TypeScript", "React", "Tailwind CSS", "REST APIs"],
      preferredSkills: ["Vitest", "Accessibility (WCAG)", "Design Systems"],
      compensationDisplay: "₹18L – ₹26L / year",
      applicationCap: 20,
      applicationCount: 0,
      status: "open",
      activeEvaluationProfileId: "prof_nimbus_v1",
      activeEvaluationProfileVersion: "1",
      evaluationProfileStatus: "ready",
      closingDate: "2026-12-25T23:59:59.000Z",
      isDemo: true,
      createdBy: "usr_recruiter_nimbus",
      createdAt: "2026-10-18T08:00:00.000Z",
      updatedAt: now,
    },
  ];
  for (const j of jobs) await db.jobs.insert(j);

  // 5. Job Evaluation Profiles
  const backendProfile: JobEvaluationProfile = {
    id: "prof_backend_v1",
    jobId: "job_backend_sr",
    companyId: "cmp_cloudscale",
    profileVersion: "1",
    rubricVersion: RESUME_SCREENING_CONFIG.rubricVersion,
    jobTitle: "Senior Backend Engineer (FastAPI / Distributed Systems)",
    criteria: [
      {
        id: "crit_tech_req",
        category: "technicalSkillsMatch",
        requirement: "Production proficiency in Python, FastAPI, Distributed Systems, PostgreSQL, and Redis",
        priority: "mandatory",
        sourceText: "Required skills: Python, FastAPI, Distributed Systems, PostgreSQL, Redis",
        evaluationGuidance: "Verify real usage in backend roles or substantial engineering projects.",
      },
      {
        id: "crit_tech_pref",
        category: "technicalSkillsMatch",
        requirement: "Experience with Go, gRPC, Kubernetes, or Prometheus",
        priority: "preferred",
        sourceText: "Preferred skills: Go, gRPC, Kubernetes, Prometheus",
        evaluationGuidance: "Reward demonstrated depth without treating missing preferred skills as disqualifiers.",
      },
      {
        id: "crit_exp",
        category: "relevantWorkExperience",
        requirement: "3–6 years building and debugging production backend or distributed systems",
        priority: "mandatory",
        sourceText: "Experience level: 3–6 years; own core distributed systems services",
        evaluationGuidance: "Check role dates, scope of ownership, and tail-latency/concurrency debugging.",
      },
      {
        id: "crit_proj",
        category: "projectsAndPracticalImplementation",
        requirement: "Practical implementation of caching, consensus, queues, or scalable APIs",
        priority: "mandatory",
        sourceText: "Architect high-throughput FastAPI/Go microservices, Redis locking, singleflight caching",
        evaluationGuidance: "Evaluate architecture depth and candidate contribution.",
      },
      {
        id: "crit_edu",
        category: "educationalQualifications",
        requirement: "B.Tech / B.E. in Computer Science or equivalent systems engineering background",
        priority: "preferred",
        sourceText: "B.Tech / B.E. in Computer Science or equivalent practical systems background",
        evaluationGuidance: "Accept equivalent CS degrees or strong practical pathways fairly.",
      },
      {
        id: "crit_pres",
        category: "resumePresentationAndReadability",
        requirement: "Clear section organization, legible formatting, and concise factual descriptions",
        priority: "informational",
        sourceText: "Fixed P1 readability rubric",
        evaluationGuidance: "Do not reward decorative templates or penalize simple layouts.",
      },
      {
        id: "crit_cert",
        category: "internshipsAndCertifications",
        requirement: "Relevant backend/cloud internships or CNCF/cloud certifications",
        priority: "informational",
        sourceText: "Optional supporting credentials",
        evaluationGuidance: "Supporting signal only; never penalize absence.",
      },
      {
        id: "crit_elig",
        category: "jobSpecificEligibility",
        requirement: "Work authorization in India and Bengaluru hybrid availability (3 days/week)",
        priority: "mandatory",
        sourceText: "Authorized to work in India; Available to work hybrid in Bengaluru (3 days/week)",
        evaluationGuidance: "Mark not_demonstrated if unstated; never infer from protected attributes.",
      },
    ],
    ambiguities: [],
    status: "ready",
    model: "gemini-4-hydrogen",
    promptVersion: "job-profile-v1",
    failureMessageSafe: null,
    createdAt: now,
    createdBy: "usr_recruiter_priya",
  };

  const mlProfile: JobEvaluationProfile = {
    ...backendProfile,
    id: "prof_ml_v1",
    jobId: "job_ml_eng",
    jobTitle: "Applied ML Infrastructure Engineer",
    criteria: [
      {
        id: "ml_tech_1",
        category: "technicalSkillsMatch",
        requirement: "Python, PyTorch, FastAPI, Docker, Vector Search",
        priority: "mandatory",
        sourceText: "Required skills: Python, PyTorch, FastAPI, Docker, Vector Search",
        evaluationGuidance: "Check applied ML inference systems experience.",
      },
      {
        id: "ml_exp_1",
        category: "relevantWorkExperience",
        requirement: "2–4 years ML platform or backend inference engineering",
        priority: "mandatory",
        sourceText: "Experience level: 2–4 years",
        evaluationGuidance: "Verify role duration and production model serving scope.",
      },
      {
        id: "ml_pres_1",
        category: "resumePresentationAndReadability",
        requirement: "Structured readable formatting",
        priority: "informational",
        sourceText: "Fixed P1 readability rubric",
        evaluationGuidance: "Evaluate clarity only.",
      },
    ],
  };

  const nimbusProfile: JobEvaluationProfile = {
    ...backendProfile,
    id: "prof_nimbus_v1",
    jobId: "job_nimbus_fe",
    companyId: "cmp_nimbus",
    jobTitle: "Frontend Platform Engineer (React / TypeScript)",
    criteria: [
      {
        id: "fe_tech_1",
        category: "technicalSkillsMatch",
        requirement: "TypeScript, React, Tailwind CSS, REST APIs",
        priority: "mandatory",
        sourceText: "Required skills: TypeScript, React, Tailwind CSS, REST APIs",
        evaluationGuidance: "Verify production TypeScript & React architecture.",
      },
      {
        id: "fe_pres_1",
        category: "resumePresentationAndReadability",
        requirement: "Structured readable formatting",
        priority: "informational",
        sourceText: "Fixed P1 readability rubric",
        evaluationGuidance: "Evaluate clarity only.",
      },
    ],
  };

  await db.jobEvaluationProfiles.insert(backendProfile);
  await db.jobEvaluationProfiles.insert(mlProfile);
  await db.jobEvaluationProfiles.insert(nimbusProfile);

  // 6. Trusted Referral Tokens
  const referrals: ReferralTokenRecord[] = [
    {
      id: "ref_8891",
      code: "#REF-8891",
      companyId: "cmp_cloudscale",
      jobId: "job_backend_sr",
      referrerName: "Siddharth Rao (Staff Engineer)",
      referrerEmail: "siddharth@cloudscale.demo",
      active: true,
      expiresAt: "2026-12-31T23:59:59.000Z",
      usedCount: 2,
      maxUses: 10,
      createdAt: now,
    },
    {
      id: "ref_9040",
      code: "#REF-9040",
      companyId: "cmp_cloudscale",
      jobId: "job_backend_sr",
      referrerName: "Ananya Sen (Engineering Manager)",
      referrerEmail: "ananya@cloudscale.demo",
      active: true,
      expiresAt: "2026-12-31T23:59:59.000Z",
      usedCount: 1,
      maxUses: 10,
      createdAt: now,
    },
  ];
  for (const r of referrals) await db.referrals.insert(r);

  // 7. Helper to create realistic demo applications + private PDF files + evaluations
  async function seedDemoApplicant(opts: {
    appId: string;
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    portfolioSlug?: string | null;
    isReferral: boolean;
    referralCodeUsed?: string | null;
    submittedAt: string;
    scores?: Record<(typeof RESUME_CATEGORY_KEYS)[number], number>;
    failedExtraction?: boolean;
    recruiterDecision?: ApplicationRecord["recruiterDecision"];
    appStatus?: ApplicationRecord["applicationStatus"];
    interviewId?: string | null;
    interviewStatus?: ApplicationRecord["interviewStatus"];
    reviewFlags?: string[];
  }) {
    const fileId = `res_${opts.appId}`;
    const pdfBuf = buildMinimalPdfBuffer(`${opts.candidateName} - Resume`, [
      `Email: ${opts.candidateEmail}`,
      `Target Role: Senior Backend Engineer (FastAPI / Distributed Systems)`,
      `Skills: Python, FastAPI, Go, gRPC, PostgreSQL, Redis, Distributed Systems`,
      `Experience: Built production low-latency services and fault-tolerant data pipelines.`,
      `Education: B.Tech Computer Science`,
    ]);
    const storageKey = storePrivateResumeFile({
      companyId: "cmp_cloudscale",
      jobId: "job_backend_sr",
      fileId,
      buffer: pdfBuf,
    });

    const resumeFile: ResumeFileRecord = {
      id: fileId,
      applicationId: opts.appId,
      candidateId: opts.candidateId,
      jobId: "job_backend_sr",
      companyId: "cmp_cloudscale",
      originalFilename: `${opts.candidateName.toLowerCase().replace(/\s+/g, "_")}_resume.pdf`,
      mimeType: "application/pdf",
      sizeBytes: pdfBuf.length,
      pageCount: 1,
      storageKey,
      processingStatus: opts.failedExtraction ? "extraction_failed" : "extracted",
      extractionReference: `ext_${opts.appId}`,
      extractedTextLength: opts.failedExtraction ? 0 : 280,
      failureCode: opts.failedExtraction ? "SCANNED_OR_EMPTY_PDF" : null,
      failureMessageSafe: opts.failedExtraction
        ? "Uploaded PDF appears to be an image-only scan without selectable text."
        : null,
      version: "1",
      createdAt: opts.submittedAt,
    };
    await db.resumeFiles.insert(resumeFile);

    if (opts.failedExtraction || !opts.scores) {
      const app: ApplicationRecord = {
        id: opts.appId,
        jobId: "job_backend_sr",
        companyId: "cmp_cloudscale",
        candidateId: opts.candidateId,
        candidateName: opts.candidateName,
        candidateEmail: opts.candidateEmail,
        portfolioSlug: opts.portfolioSlug ?? null,
        resumeFileId: fileId,
        resumeFilename: resumeFile.originalFilename,
        resumeProcessingStatus: "extraction_failed",
        evaluationStatus: "failed",
        screeningResult: "not_determined",
        weightedScore: null,
        isReferral: opts.isReferral,
        referralCodeUsed: opts.referralCodeUsed ?? null,
        recruiterDecision: "pending",
        applicationStatus: "screening_failed",
        reviewFlags: [
          "Uploaded PDF appears to be an image-only scan without selectable text.",
        ],
        submittedAt: opts.submittedAt,
        updatedAt: opts.submittedAt,
      };
      await db.applications.insert(app);
      return;
    }

    const weightedScore = calculateWeightedScore(opts.scores);
    const screeningResult = weightedScore >= 60 ? "qualified" : "not_qualified";
    const needsReview = (opts.reviewFlags?.length ?? 0) > 0;

    const evalRec: ResumeEvaluationRecord = {
      id: `evl_${opts.appId}`,
      applicationId: opts.appId,
      candidateId: opts.candidateId,
      jobId: "job_backend_sr",
      companyId: "cmp_cloudscale",
      resumeFileId: fileId,
      resumeFileVersion: "1",
      extractionStatus: "extracted",
      extractionReference: `ext_${opts.appId}`,
      evaluationStatus: needsReview ? "needs_review" : "completed",
      screeningResult,
      categoryScores: opts.scores,
      categoryEvaluations: RESUME_CATEGORY_KEYS.map((cat) => ({
        category: cat,
        score: opts.scores![cat],
        evidence: [
          {
            description: `Resume demonstrates ${cat} signals aligned with Senior Backend Engineer rubric.`,
            excerpt:
              cat === "technicalSkillsMatch"
                ? "Python, FastAPI, Distributed Systems, PostgreSQL, Redis, Go"
                : `Verified structured section for ${cat}`,
            pageNumber: 1,
            extractionReference: `ext_${opts.appId}`,
            criterionId: backendProfile.criteria.find((c) => c.category === cat)?.id,
            evidenceStatus: opts.scores![cat] >= 60 ? "demonstrated" : "unclear",
          },
        ],
        matchedCriteria: backendProfile.criteria
          .filter((c) => c.category === cat && opts.scores![cat] >= 65)
          .map((c) => c.id),
        unmatchedCriteria: backendProfile.criteria
          .filter((c) => c.category === cat && opts.scores![cat] < 65)
          .map((c) => c.id),
        explanation: `Assigned ${opts.scores![cat]}/100 based on extracted evidence in Page 1.`,
        confidence: needsReview && cat === "jobSpecificEligibility" ? "low" : "high",
        limitations:
          cat === "jobSpecificEligibility"
            ? ["Hybrid Bengaluru availability inferred from city header only; confirm at interview."]
            : [],
      })),
      weightedScore,
      qualificationThreshold: 60,
      isReferralAtEvaluation: opts.isReferral,
      jobEvaluationProfileId: backendProfile.id,
      jobEvaluationProfileVersion: "1",
      rubricVersion: RESUME_SCREENING_CONFIG.rubricVersion,
      model: "gemini-4-hydrogen",
      promptVersion: "resume-eval-v1",
      overallObservations: [
        `Weighted ATS score ${weightedScore.toFixed(2)} computed deterministically across 7 fixed categories.`,
      ],
      reviewFlags: opts.reviewFlags ?? [],
      failureCode: null,
      failureMessageSafe: null,
      createdAt: opts.submittedAt,
      updatedAt: opts.submittedAt,
      completedAt: opts.submittedAt,
    };
    await db.resumeEvaluations.insert(evalRec);

    const app: ApplicationRecord = {
      id: opts.appId,
      jobId: "job_backend_sr",
      companyId: "cmp_cloudscale",
      candidateId: opts.candidateId,
      candidateName: opts.candidateName,
      candidateEmail: opts.candidateEmail,
      portfolioSlug: opts.portfolioSlug ?? null,
      resumeFileId: fileId,
      resumeFilename: resumeFile.originalFilename,
      resumeProcessingStatus: "extracted",
      evaluationStatus: needsReview ? "needs_review" : "completed",
      screeningResult,
      weightedScore,
      isReferral: opts.isReferral,
      referralCodeUsed: opts.referralCodeUsed ?? null,
      recruiterDecision: opts.recruiterDecision ?? "pending",
      applicationStatus:
        opts.appStatus ??
        (needsReview ? "screening_needs_review" : "screening_completed"),
      interviewId: opts.interviewId ?? null,
      interviewStatus: opts.interviewStatus ?? null,
      reviewFlags: opts.reviewFlags ?? [],
      submittedAt: opts.submittedAt,
      updatedAt: opts.submittedAt,
    };
    await db.applications.insert(app);
  }

  // Referrals (must rank first in qualified list: Arjun 94.30 -> Elena 88.25 -> Vikram 82.00 -> Sneha 74.50)
  await seedDemoApplicant({
    appId: "app_arjun",
    candidateId: "usr_student_arjun",
    candidateName: "Arjun Mehta",
    candidateEmail: "arjun.mehta@iitd.demo",
    portfolioSlug: "arjun-mehta",
    isReferral: true,
    referralCodeUsed: "#REF-8891",
    submittedAt: "2026-10-18T10:00:00.000Z",
    scores: {
      technicalSkillsMatch: 96, // 28.8
      relevantWorkExperience: 95, // 19.0
      projectsAndPracticalImplementation: 96, // 14.4
      educationalQualifications: 95, // 9.5
      resumePresentationAndReadability: 92, // 9.2
      internshipsAndCertifications: 88, // 4.4
      jobSpecificEligibility: 90, // 9.0 -> total = 94.30
    },
    recruiterDecision: "interview_invited",
    appStatus: "interview_completed",
    interviewId: "int_arjun_demo",
    interviewStatus: "report_ready",
  });

  await seedDemoApplicant({
    appId: "app_elena",
    candidateId: "usr_student_elena",
    candidateName: "Elena Rostova",
    candidateEmail: "elena.rostova@demo.hirezilla",
    isReferral: true,
    referralCodeUsed: "#REF-8891",
    submittedAt: "2026-10-18T11:00:00.000Z",
    scores: {
      technicalSkillsMatch: 90, // 27
      relevantWorkExperience: 88, // 17.6
      projectsAndPracticalImplementation: 85, // 12.75
      educationalQualifications: 90, // 9
      resumePresentationAndReadability: 89, // 8.9
      internshipsAndCertifications: 80, // 4
      jobSpecificEligibility: 90, // 9 -> total = 88.25
    },
    recruiterDecision: "shortlisted",
    appStatus: "shortlisted",
  });

  await seedDemoApplicant({
    appId: "app_vikram",
    candidateId: "usr_student_vikram",
    candidateName: "Vikram Nair",
    candidateEmail: "vikram.nair@demo.hirezilla",
    isReferral: true,
    referralCodeUsed: "#REF-9040",
    submittedAt: "2026-10-18T12:00:00.000Z",
    scores: {
      technicalSkillsMatch: 85, // 25.5
      relevantWorkExperience: 80, // 16
      projectsAndPracticalImplementation: 80, // 12
      educationalQualifications: 80, // 8
      resumePresentationAndReadability: 85, // 8.5
      internshipsAndCertifications: 80, // 4
      jobSpecificEligibility: 80, // 8 -> total = 82.00
    },
  });

  await seedDemoApplicant({
    appId: "app_sneha",
    candidateId: "usr_student_sneha",
    candidateName: "Sneha Kulkarni",
    candidateEmail: "sneha.kulkarni@demo.hirezilla",
    isReferral: true,
    referralCodeUsed: "#REF-8891",
    submittedAt: "2026-10-18T13:00:00.000Z",
    scores: {
      technicalSkillsMatch: 75, // 22.5
      relevantWorkExperience: 70, // 14
      projectsAndPracticalImplementation: 80, // 12
      educationalQualifications: 75, // 7.5
      resumePresentationAndReadability: 80, // 8
      internshipsAndCertifications: 70, // 3.5
      jobSpecificEligibility: 70, // 7 -> total = 74.50
    },
    reviewFlags: ["Low confidence on jobSpecificEligibility hybrid availability"],
  });

  // Non-referrals (Rohan 96.00 & Meera 96.00 -> intentional exact tie AFTER referred Sneha 74.50!)
  await seedDemoApplicant({
    appId: "app_rohan",
    candidateId: "usr_student_rohan",
    candidateName: "Rohan Verma",
    candidateEmail: "rohan.verma@demo.hirezilla",
    isReferral: false,
    submittedAt: "2026-10-18T09:30:00.000Z",
    scores: {
      technicalSkillsMatch: 98, // 29.4
      relevantWorkExperience: 95, // 19.0
      projectsAndPracticalImplementation: 96, // 14.4
      educationalQualifications: 92, // 9.2
      resumePresentationAndReadability: 95, // 9.5
      internshipsAndCertifications: 90, // 4.5
      jobSpecificEligibility: 100, // 10 -> total = 96.00
    },
  });

  await seedDemoApplicant({
    appId: "app_meera",
    candidateId: "usr_student_meera",
    candidateName: "Meera Iyer",
    candidateEmail: "meera.iyer@demo.hirezilla",
    isReferral: false,
    submittedAt: "2026-10-18T09:45:00.000Z",
    scores: {
      technicalSkillsMatch: 94, // 28.2
      relevantWorkExperience: 98, // 19.6
      projectsAndPracticalImplementation: 96, // 14.4
      educationalQualifications: 98, // 9.8
      resumePresentationAndReadability: 95, // 9.5
      internshipsAndCertifications: 90, // 4.5
      jobSpecificEligibility: 100, // 10 -> total = 96.00
    },
  });

  // Unqualified (< 60%)
  await seedDemoApplicant({
    appId: "app_kabir",
    candidateId: "usr_student_kabir",
    candidateName: "Kabir Joshi",
    candidateEmail: "kabir.joshi@demo.hirezilla",
    isReferral: false,
    submittedAt: "2026-10-18T14:00:00.000Z",
    scores: {
      technicalSkillsMatch: 55, // 16.5
      relevantWorkExperience: 45, // 9
      projectsAndPracticalImplementation: 60, // 9
      educationalQualifications: 70, // 7
      resumePresentationAndReadability: 65, // 6.5
      internshipsAndCertifications: 40, // 2
      jobSpecificEligibility: 40, // 4 -> total = 54.00
    },
  });

  // Failed extraction (never scored 0)
  await seedDemoApplicant({
    appId: "app_neha",
    candidateId: "usr_student_neha",
    candidateName: "Neha Patel",
    candidateEmail: "neha.patel@demo.hirezilla",
    isReferral: false,
    submittedAt: "2026-10-18T15:00:00.000Z",
    failedExtraction: true,
  });

  // 8. Interview Question Set & Arjun's Completed Interview + Report (matching Stitch Screen 1)
  const questionSet: InterviewQuestionSet = {
    id: "qset_backend_1",
    jobId: "job_backend_sr",
    companyId: "cmp_cloudscale",
    version: 1,
    status: "published",
    durationMinutes: 60,
    questions: [
      {
        id: "q_1",
        prompt: "Cache Invalidation & Distributed Thundering Herd: How do you prevent 100k RPS cache stampedes when a hot Redis key expires?",
        competency: "Distributed Caching & Lease Locks",
        rubricSignals: ["Singleflight coalescing", "Redis lease locks", "Stale-while-revalidate"],
        expectedTimeMinutes: 12,
      },
      {
        id: "q_2",
        prompt: "Handling Backpressure & Distributed Deadlocks in gRPC Microservices: Diagnose stalled goroutines during downstream node failover and redesign the ingestion channel.",
        competency: "Architecture & Concurrency Control",
        rubricSignals: ["pprof goroutine/block profiling", "HTTP/2 WINDOW_UPDATE flow control", "Bounded ring buffers & ResourceExhausted"],
        expectedTimeMinutes: 12,
      },
      {
        id: "q_3",
        prompt: "Distributed Consensus & Raft Split-Brain Quorum: Explain pre-vote protocol safeguards, heartbeat jitter, and log compaction snapshots.",
        competency: "Consensus Protocols",
        rubricSignals: ["Pre-vote term inflation prevention", "Quorum fencing", "Snapshot installation"],
        expectedTimeMinutes: 12,
      },
      {
        id: "q_4",
        prompt: "Database Sharding, Hotspots & Partition Skew: Mitigate tenant key skew on PostgreSQL shards with zero-downtime migration.",
        competency: "Storage & Partitioning",
        rubricSignals: ["Consistent hashing with virtual nodes", "Dual-write shadow backfill", "Hot-key splitting"],
        expectedTimeMinutes: 12,
      },
      {
        id: "q_5",
        prompt: "Failure Modes, Circuit Breakers & Graceful Degradation: Design adaptive shedding thresholds when downstream dependencies degrade.",
        competency: "Resilience & Chaos Engineering",
        rubricSignals: ["Adaptive concurrency limits", "Fallback local cache", "Retry jitter"],
        expectedTimeMinutes: 12,
      },
    ],
    createdBy: "usr_recruiter_priya",
    createdAt: now,
    updatedAt: now,
  };
  await db.interviewQuestionSets.insert(questionSet);

  const arjunSession: InterviewSession = {
    id: "int_arjun_demo",
    applicationId: "app_arjun",
    jobId: "job_backend_sr",
    companyId: "cmp_cloudscale",
    candidateId: "usr_student_arjun",
    candidateName: "Arjun Mehta",
    questionSetId: questionSet.id,
    questionSetVersion: 1,
    questions: questionSet.questions,
    token: "HZ-INT-7749-SEC",
    status: "report_ready",
    durationMinutes: 60,
    deadlineAt: "2026-10-25T23:59:59.000Z",
    invitedAt: "2026-10-19T10:00:00.000Z",
    startedAt: "2026-10-20T08:03:00.000Z",
    submittedAt: "2026-10-20T08:45:00.000Z",
    emailDeliveryStatus: "sent",
    reportId: "rep_arjun_demo",
    answers: [
      {
        questionId: "q_1",
        answerText:
          "Use golang.org/x/sync/singleflight keyed by cache key to coalesce concurrent misses per worker, backed by a short-TTL Redis SET NX PX lease token and stale-while-revalidate soft expiry.",
        wordCount: 28,
        updatedAt: "2026-10-20T08:12:00.000Z",
        timeSpentSeconds: 480,
      },
      {
        questionId: "q_2",
        answerText:
          "1. Root Cause Diagnosis & Contention Profiling: Attach net/http/pprof to running microservice nodes and dump blocked goroutines via /debug/pprof/goroutine?debug=2 and /debug/pprof/block. Look specifically for goroutines stalled in sync.(*Mutex).Lock or channel send operations runtime.chansend1 waiting on full channels. Inspect TCP socket write-buffer metrics (ss -ti) to verify if HTTP/2 WINDOW_UPDATE frames are stalling due to downstream unread buffers, triggering TCP Zero Window packets.\n\n2. Architectural Remediation & Channel Redesign: Replace raw unbuffered channels with a bounded lock-free circular ring buffer (or partitioned buffered worker pools). When ingress reaches high-water mark (>85% capacity), emit gRPC ResourceExhausted with a Retry-After header instead of blocking callers indefinitely.",
        wordCount: 104,
        updatedAt: "2026-10-20T08:24:00.000Z",
        timeSpentSeconds: 700,
      },
      {
        questionId: "q_3",
        answerText:
          "Implement the Raft Pre-Vote extension so partitioned followers do not increment term numbers on isolated elections, randomized election timeouts (150–300ms), and chunked InstallSnapshot RPCs bounded by disk IOPS.",
        wordCount: 30,
        updatedAt: "2026-10-20T08:31:00.000Z",
        timeSpentSeconds: 420,
      },
      {
        questionId: "q_4",
        answerText:
          "Adopt consistent hashing with virtual nodes per tenant, salt ultra-hot composite keys across sub-buckets, and perform zero-downtime migration using logical replication + dual-write verification before cutover.",
        wordCount: 27,
        updatedAt: "2026-10-20T08:38:00.000Z",
        timeSpentSeconds: 420,
      },
      {
        questionId: "q_5",
        answerText:
          "Pair Little's Law adaptive concurrency limits with exponential-backoff jitter, per-tenant token buckets, and read-only stale snapshot fallbacks so non-critical telemetry drops gracefully before core writes degrade.",
        wordCount: 28,
        updatedAt: "2026-10-20T08:45:00.000Z",
        timeSpentSeconds: 500,
      },
    ],
    auditTrail: [
      { timestamp: "2026-10-20T08:45:00.000Z", message: "Candidate submitted 5/5 scenario answers." },
      { timestamp: "2026-10-20T08:46:00.000Z", message: "AI Rubric engine parsed & verified citations." },
      { timestamp: "2026-10-20T09:00:00.000Z", message: "Lead Recruiter Priya S. opened report dossier." },
    ],
  };
  await db.interviews.insert(arjunSession);

  const arjunReport: InterviewReport = {
    id: "rep_arjun_demo",
    interviewId: "int_arjun_demo",
    applicationId: "app_arjun",
    jobId: "job_backend_sr",
    companyId: "cmp_cloudscale",
    overallInterviewScore: 91.8,
    atsCumulativeScore: 94.3,
    targetLevelLabel: "Target Level L5/L6",
    confidence: "high",
    dimensions: [
      {
        name: "Architecture & Systems",
        score: 94,
        rubricTarget: 85,
        summary: "Exceptional distributed ring-buffer backpressure model & deadlock triage.",
      },
      {
        name: "Implementation Rigor",
        score: 92,
        rubricTarget: 80,
        summary: "High familiarity with Go runtime internals, sync.Mutex contention, & pprof.",
      },
      {
        name: "Edge Cases & Resilience",
        score: 89,
        rubricTarget: 80,
        summary: "Addressed TCP zero window, cascade failovers, & graceful drop-tail rules.",
      },
      {
        name: "Technical Clarity",
        score: 92,
        rubricTarget: 75,
        summary: "Structured step-by-step markdown, pragmatic engineering rationale, zero fluff.",
      },
    ],
    synthesisSummary:
      "Arjun completed all 5 scenarios with remarkable consistency, exhibiting mechanical sympathy with the Go runtime memory model, channel scheduling mechanics, and HTTP/2 transport dynamics. Answers reflect direct production debugging experience with kernel socket states (ss -ti) and pprof primitives.",
    verifiedStrengths: [
      "Immediate identification of runtime.chansend1 blocking cascades.",
      "Sound lock-free ring-buffer and worker decoupling.",
      "Proactive graceful degradation with gRPC ResourceExhausted headers.",
    ],
    recommendedDeepDive:
      "Probe how client stream timeouts are coordinated across downstream Redis lease locks during prolonged partition splits to avoid silent lock expirations.",
    questionEvaluations: [
      {
        questionId: "q_1",
        questionPrompt: questionSet.questions[0].prompt,
        competency: questionSet.questions[0].competency,
        score: 90,
        ratingLabel: "Strong",
        rubricChecks: ["Singleflight coalescing", "Redis lease locks"],
        evidenceFromAnswer: "Cited golang.org/x/sync/singleflight and SET NX PX lease tokens.",
        evaluatorNote: "Concise and accurate thundering-herd mitigation.",
        confidence: "high",
        limitations: [],
      },
      {
        questionId: "q_2",
        questionPrompt: questionSet.questions[1].prompt,
        competency: questionSet.questions[1].competency,
        score: 95,
        ratingLabel: "Exceptional",
        rubricChecks: [
          "Concurrency & Deadlock Triage",
          "HTTP/2 WINDOW_UPDATE Flow Control",
          "Go Runtime Channel Internals",
        ],
        evidenceFromAnswer:
          "Identified /debug/pprof/block, runtime.chansend1 stalls, ss -ti TCP Zero Window, and ResourceExhausted backpressure.",
        evaluatorNote:
          "Accurately identifies runtime.chansend1 stall mechanism. Applied bounded ring buffer strategy consistent with L5/L6 infrastructure standards.",
        portfolioCitation: "github.com/arjunmehta/raft-kv-core (buffer/ring.go)",
        confidence: "high",
        limitations: [],
      },
      {
        questionId: "q_3",
        questionPrompt: questionSet.questions[2].prompt,
        competency: questionSet.questions[2].competency,
        score: 92,
        ratingLabel: "Strong",
        rubricChecks: ["Pre-Vote protocol", "Snapshot chunking"],
        evidenceFromAnswer: "Covered Pre-Vote term inflation prevention and bounded InstallSnapshot RPCs.",
        evaluatorNote: "Solid operational grasp of Raft split-brain protections.",
        confidence: "high",
        limitations: [],
      },
      {
        questionId: "q_4",
        questionPrompt: questionSet.questions[3].prompt,
        competency: questionSet.questions[3].competency,
        score: 91,
        ratingLabel: "Strong",
        rubricChecks: ["Virtual node hashing", "Zero-downtime migration"],
        evidenceFromAnswer: "Proposed salted composite buckets and logical replication dual-write cutover.",
        evaluatorNote: "Pragmatic Postgres shard skew remediation.",
        confidence: "high",
        limitations: [],
      },
      {
        questionId: "q_5",
        questionPrompt: questionSet.questions[4].prompt,
        competency: questionSet.questions[4].competency,
        score: 91,
        ratingLabel: "Strong",
        rubricChecks: ["Adaptive concurrency limits", "Graceful shedding"],
        evidenceFromAnswer: "Applied Little's Law adaptive concurrency limits with per-tenant token buckets.",
        evaluatorNote: "Balanced failure isolation strategy.",
        confidence: "high",
        limitations: [],
      },
    ],
    model: "gemini-4-hydrogen",
    promptVersion: "interview-eval-v1",
    recruiterRecommendation: "strong",
    recruiterNotes: "",
    createdAt: "2026-10-20T08:46:00.000Z",
    updatedAt: "2026-10-20T08:46:00.000Z",
  };
  await db.interviewReports.insert(arjunReport);

  // 9. Sample moderation report flag for Admin console
  const sampleFlag: ReportFlagRecord = {
    id: "flg_demo_1",
    targetType: "job",
    targetId: "job_nimbus_fe",
    targetTitle: "Frontend Platform Engineer (React / TypeScript)",
    reporterUserId: "usr_student_arjun",
    reason: "Clarification requested on hybrid attendance frequency",
    details: "Job listing mentions Mumbai hybrid without specifying days per week.",
    status: "open",
    createdAt: "2026-10-19T14:20:00.000Z",
  };
  await db.flags.insert(sampleFlag);
}
