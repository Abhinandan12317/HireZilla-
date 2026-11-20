import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileText } from "lucide-react";
import { RESUME_CATEGORY_LABELS, RESUME_WEIGHTS } from "../../../shared/constants";
import type {
  ApplicationRecord,
  JobEvaluationProfile,
  JobPosting,
  ResumeEvaluationRecord,
} from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { apiRequest, apiUrl } from "../lib/api";
import { getRouteParam, routes } from "../lib/navigation";

interface EvalDetailResponse {
  application: ApplicationRecord;
  evaluation: ResumeEvaluationRecord | null;
  job: JobPosting | null;
  jobEvaluationProfile: JobEvaluationProfile | null;
}

export function CandidateEvaluationDetailPage() {
  const applicationId = getRouteParam(
    "applicationId",
    /^\/recruiter\/applications\/([^/]+)/
  );
  const { pushToast } = useToast();
  const [data, setData] = useState<EvalDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"categories" | "evidence" | "criteria" | "overview">(
    "categories"
  );
  const [reviewNote, setReviewNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const load = () => {
    if (!applicationId) return;
    setLoading(true);
    apiRequest<EvalDetailResponse>(
      `/api/applications/${applicationId}/resume-evaluation`
    )
      .then(setData)
      .catch((err) =>
        pushToast("error", err instanceof Error ? err.message : "Failed to load dossier.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [applicationId]);

  const handleDownload = async () => {
    if (!data) return;
    const res = await apiRequest<{ downloadUrl: string }>(
      `/api/resumes/${data.application.resumeFileId}/signed-url`
    );
    window.location.href = apiUrl(res.downloadUrl);
  };

  const handleResolveReview = async () => {
    if (!data || reviewNote.trim().length < 5) {
      pushToast("error", "Enter a review resolution note (min 5 chars).");
      return;
    }
    try {
      await apiRequest(`/api/applications/${data.application.id}/resolve-review`, {
        method: "POST",
        body: JSON.stringify({ note: reviewNote }),
      });
      pushToast("success", "Human review flag resolved.");
      setReviewNote("");
      load();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to resolve review.");
    }
  };

  const handleDecision = async (
    decision: "shortlisted" | "on_hold" | "not_selected"
  ) => {
    if (!data) return;
    if (decision === "not_selected" && rejectReason.trim().length < 3) {
      pushToast("error", "Provide a job-related reason when marking Not Proceeding.");
      return;
    }
    try {
      await apiRequest(`/api/applications/${data.application.id}/decision`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          reason: decision === "not_selected" ? rejectReason : undefined,
        }),
      });
      pushToast("success", `Updated candidate status to ${decision.replace("_", " ")}.`);
      load();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to save decision.");
    }
  };

  return (
    <WorkspaceShell
      title={data ? data.application.candidateName : "Candidate Evaluation"}
      subtitle={data?.job ? `${data.job.title} · ATS & Evidence Dossier` : ""}
    >
      {loading ? (
        <div className="h-72 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
      ) : !data ? (
        <p className="text-sm text-status-danger">Application dossier not found.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <a
              href={routes.recruiterJobApplicants(data.application.jobId)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Ranked Applicants</span>
            </a>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border-subtle bg-surface-card text-xs font-bold"
              >
                <Download className="w-4 h-4 text-primary" />
                <span>Download Resume PDF</span>
              </button>
              {data.application.interviewId && (
                <a
                  href={routes.recruiterInterviewReport(data.application.id)}
                  className="px-4 py-2 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold"
                >
                  Open AI Text Interview Report
                </a>
              )}
            </div>
          </div>

          {/* Summary Header */}
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-2xl text-on-surface">
                  {data.application.candidateName}
                </h2>
                {data.application.isReferral && <StatusBadge variant="referral" />}
                <StatusBadge
                  variant={
                    data.application.screeningResult === "qualified"
                      ? "qualified"
                      : data.application.screeningResult === "not_qualified"
                        ? "not_qualified"
                        : "failed"
                  }
                />
                {data.application.recruiterDecision !== "pending" && (
                  <StatusBadge variant={data.application.recruiterDecision} />
                )}
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                {data.application.candidateEmail} · File: {data.application.resumeFilename}
              </p>
              {data.application.portfolioSlug && (
                <a
                  href={routes.portfolio(data.application.portfolioSlug)}
                  className="inline-block mt-1 text-xs font-bold text-primary hover:underline"
                >
                  View Public Portfolio (/p/{data.application.portfolioSlug}) →
                </a>
              )}
            </div>

            <div className="text-right bg-paper-base px-5 py-3 rounded-xl border border-border-subtle">
              <p className="text-[11px] font-bold uppercase text-outline">
                Weighted ATS Score (Threshold 60.00%)
              </p>
              <p className="font-display font-bold text-3xl text-primary tabular-nums">
                {data.application.weightedScore !== null
                  ? `${data.application.weightedScore.toFixed(2)}%`
                  : "Not determined"}
              </p>
            </div>
          </div>

          {/* Review Warning */}
          {data.application.evaluationStatus === "needs_review" && (
            <div className="p-5 rounded-2xl bg-status-warning/12 border border-status-warning/40 space-y-3">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-5 h-5 text-status-warning shrink-0" />
                <div>
                  <p className="font-bold text-on-surface">Human Review Needed</p>
                  <p className="text-on-surface-variant mt-0.5">
                    {data.application.reviewFlags.join("; ")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Record human verification note (min 5 chars)..."
                  className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                />
                <button
                  type="button"
                  onClick={handleResolveReview}
                  className="px-4 py-2 rounded-lg bg-status-warning text-white text-xs font-bold"
                >
                  Mark Review Resolved
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["categories", "7 Category Scores"],
                ["evidence", "Evidence & Limitations"],
                ["criteria", "Job Profile Criteria"],
                ["overview", "Decisions & Notes"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold ${
                  tab === id
                    ? "bg-primary-container text-white"
                    : "bg-surface-card border border-border-subtle text-on-surface-variant"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab Body */}
          {tab === "categories" && data.evaluation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.evaluation.categoryEvaluations.map((c) => (
                <div
                  key={c.category}
                  className="bg-surface-card rounded-xl border border-border-subtle p-5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm">
                      {RESUME_CATEGORY_LABELS[c.category]} ({RESUME_WEIGHTS[c.category]}%)
                    </span>
                    <span className="font-mono font-bold text-lg text-primary tabular-nums">
                      {c.score}/100
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{c.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "evidence" && data.evaluation && (
            <div className="space-y-4">
              {data.evaluation.categoryEvaluations.map((c) => (
                <div
                  key={c.category}
                  className="bg-surface-card rounded-xl border border-border-subtle p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-base">
                      {RESUME_CATEGORY_LABELS[c.category]}
                    </h3>
                    <span className="text-xs font-bold text-outline uppercase">
                      {c.confidence} confidence
                    </span>
                  </div>
                  {c.evidence.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-paper-base border border-border-subtle text-xs space-y-1"
                    >
                      <p className="font-bold text-on-surface">
                        [{ev.evidenceStatus}] {ev.description}
                      </p>
                      {ev.excerpt && (
                        <p className="font-mono text-primary">
                          &ldquo;{ev.excerpt}&rdquo;{" "}
                          {ev.pageNumber ? `· Page ${ev.pageNumber}` : ""}
                        </p>
                      )}
                    </div>
                  ))}
                  {c.limitations.length > 0 && (
                    <p className="text-xs text-status-warning">
                      Limitations: {c.limitations.join("; ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "criteria" && data.jobEvaluationProfile && (
            <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 space-y-3">
              <p className="text-xs font-bold text-primary">
                Job Evaluation Profile v{data.jobEvaluationProfile.profileVersion} · Rubric{" "}
                {data.jobEvaluationProfile.rubricVersion}
              </p>
              {data.jobEvaluationProfile.criteria.map((cr) => (
                <div
                  key={cr.id}
                  className="p-3 rounded-lg bg-paper-base border border-border-subtle text-xs"
                >
                  <div className="flex justify-between font-bold">
                    <span>{RESUME_CATEGORY_LABELS[cr.category]}</span>
                    <span className="uppercase text-primary">{cr.priority}</span>
                  </div>
                  <p className="mt-1 font-semibold">{cr.requirement}</p>
                  <p className="text-outline mt-0.5 italic">Source: {cr.sourceText}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "overview" && (
            <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 space-y-4">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Recruiter Decision Controls</span>
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={data.application.screeningResult !== "qualified"}
                  onClick={() => handleDecision("shortlisted")}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Shortlist Candidate</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision("on_hold")}
                  className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs font-bold"
                >
                  Put On Hold
                </button>
              </div>
              <div className="pt-3 border-t border-border-subtle flex flex-wrap gap-2">
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Job-related reason for Not Proceeding..."
                  className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleDecision("not_selected")}
                  className="px-4 py-2 rounded-lg bg-status-danger text-white text-xs font-bold"
                >
                  Mark Not Proceeding
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}
