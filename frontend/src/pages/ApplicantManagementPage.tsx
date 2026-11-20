import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSearch,
  RefreshCw,
  Scale,
  Ticket,
  X,
} from "lucide-react";
import { RESUME_CATEGORY_LABELS, RESUME_WEIGHTS } from "../../../shared/constants";
import type {
  ApplicationRecord,
  ReferralTokenRecord,
  ResumeEvaluationRecord,
} from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { apiRequest, apiUrl } from "../lib/api";
import { getRouteParam, routes } from "../lib/navigation";

interface ApplicationsResponse {
  jobId: string;
  jobTitle: string;
  applicationCap: number;
  applicationCount: number;
  screeningThreshold: number;
  rankingRule: string;
  counts: {
    all: number;
    qualified: number;
    qualifiedReferrals: number;
    notQualified: number;
    needsReview: number;
    failed: number;
    processing: number;
    shortlisted: number;
    interview: number;
  };
  tieGroups: Array<{
    tieGroupKey: string;
    weightedScore: number;
    count: number;
    candidateNames: string[];
  }>;
  items: ApplicationRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export function ApplicantManagementPage() {
  const rawJobId = getRouteParam("jobId", /^\/recruiter\/jobs\/([^/]+)/);
  const jobId = rawJobId && rawJobId !== "applicants" ? rawJobId : undefined;
  const { pushToast } = useToast();

  const [tab, setTab] = useState("qualified");
  const [page, setPage] = useState(1);
  const [referralFilter, setReferralFilter] = useState("all");
  const [sortMode, setSortMode] = useState("referral_then_score");
  const [data, setData] = useState<ApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [selectedEval, setSelectedEval] = useState<ResumeEvaluationRecord | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  const [referrals, setReferrals] = useState<ReferralTokenRecord[]>([]);
  const [newRefName, setNewRefName] = useState("");
  const [newRefEmail, setNewRefEmail] = useState("");
  const [showRefModal, setShowRefModal] = useState(false);

  const fetchApplicants = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        screening: tab,
        sort: sortMode,
        referral: referralFilter,
        page: String(page),
        limit: "20",
      });
      const res = await apiRequest<ApplicationsResponse>(
        `/api/jobs/${jobId}/applications?${params.toString()}`
      );
      setData(res);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to load applicants.");
    } finally {
      setLoading(false);
    }
  }, [jobId, tab, sortMode, referralFilter, page]);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  const loadReferrals = () => {
    if (!jobId) return;
    apiRequest<{ referrals: ReferralTokenRecord[] }>(`/api/recruiter/jobs/${jobId}/referrals`)
      .then((res) => setReferrals(res.referrals))
      .catch(() => {});
  };

  useEffect(() => {
    loadReferrals();
  }, [jobId]);

  const openEvidenceDrawer = async (app: ApplicationRecord) => {
    setSelectedApp(app);
    setEvalLoading(true);
    try {
      const res = await apiRequest<{
        application: ApplicationRecord;
        evaluation: ResumeEvaluationRecord | null;
      }>(`/api/applications/${app.id}/resume-evaluation`);
      setSelectedApp(res.application);
      setSelectedEval(res.evaluation);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Could not load evaluation.");
    } finally {
      setEvalLoading(false);
    }
  };

  const handleDownloadResume = async (fileId: string) => {
    try {
      const res = await apiRequest<{ downloadUrl: string }>(
        `/api/resumes/${fileId}/signed-url`
      );
      window.location.href = apiUrl(res.downloadUrl);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Resume download failed.");
    }
  };

  const handleDecision = async (
    appId: string,
    decision: "shortlisted" | "on_hold" | "not_selected",
    reason?: string
  ) => {
    try {
      await apiRequest(`/api/applications/${appId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      });
      pushToast("success", `Candidate marked ${decision.replace("_", " ")}.`);
      await fetchApplicants();
      if (selectedApp?.id === appId) {
        await openEvidenceDrawer(selectedApp);
      }
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Decision failed.");
    }
  };

  const handleRetryEval = async (appId: string) => {
    try {
      await apiRequest(`/api/applications/${appId}/retry-evaluation`, { method: "POST" });
      pushToast("success", "Re-evaluation run completed.");
      await fetchApplicants();
      if (selectedApp?.id === appId) {
        await openEvidenceDrawer(selectedApp);
      }
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Retry failed.");
    }
  };

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;
    try {
      const res = await apiRequest<{ referral: ReferralTokenRecord }>(
        `/api/recruiter/jobs/${jobId}/referrals`,
        {
          method: "POST",
          body: JSON.stringify({ referrerName: newRefName, referrerEmail: newRefEmail }),
        }
      );
      pushToast("success", `Referral code ${res.referral.code} created.`);
      setNewRefName("");
      setNewRefEmail("");
      loadReferrals();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to create referral.");
    }
  };

  const referralItems =
    tab === "qualified" && sortMode === "referral_then_score"
      ? (data?.items ?? []).filter((a) => a.isReferral)
      : [];
  const otherQualifiedItems =
    tab === "qualified" && sortMode === "referral_then_score"
      ? (data?.items ?? []).filter((a) => !a.isReferral)
      : data?.items ?? [];

  const renderApplicantRow = (app: ApplicationRecord) => (
    <tr
      key={app.id}
      className="hover:bg-paper-base/70 transition-colors cursor-pointer"
      onClick={() => openEvidenceDrawer(app)}
    >
      <td className="py-3.5 px-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-fixed text-primary font-display font-bold text-xs flex items-center justify-center shrink-0">
            {app.candidateName
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <p className="font-bold text-on-surface">{app.candidateName}</p>
            <p className="text-xs text-outline">{app.candidateEmail}</p>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-3">
        {app.isReferral ? (
          <StatusBadge variant="referral" />
        ) : (
          <span className="text-xs text-outline">Direct</span>
        )}
      </td>
      <td className="py-3.5 px-3 font-mono font-bold text-on-surface tabular-nums">
        {typeof app.weightedScore === "number" ? (
          <span>{app.weightedScore.toFixed(2)}%</span>
        ) : (
          <span className="text-outline font-normal">—</span>
        )}
      </td>
      <td className="py-3.5 px-3">
        <StatusBadge
          variant={
            app.screeningResult === "qualified"
              ? "qualified"
              : app.screeningResult === "not_qualified"
                ? "not_qualified"
                : app.evaluationStatus === "failed"
                  ? "failed"
                  : "processing"
          }
          customLabel={
            app.screeningResult === "not_determined"
              ? app.resumeProcessingStatus === "extraction_failed"
                ? "Extraction failed"
                : "Pending"
              : undefined
          }
        />
      </td>
      <td className="py-3.5 px-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            variant={
              app.evaluationStatus === "completed"
                ? "qualified"
                : app.evaluationStatus === "needs_review"
                  ? "needs_review"
                  : app.evaluationStatus === "failed"
                    ? "failed"
                    : "processing"
            }
            customLabel={app.evaluationStatus.replace("_", " ")}
          />
          {app.recruiterDecision !== "pending" && (
            <StatusBadge variant={app.recruiterDecision} />
          )}
        </div>
      </td>
      <td
        className="py-3.5 px-5 text-right space-x-2 whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => openEvidenceDrawer(app)}
          className="px-3 py-1.5 rounded-lg bg-surface-container text-primary text-xs font-bold hover:bg-primary-fixed"
        >
          Evidence
        </button>
        <a
          href={routes.recruiterCandidateDossier(app.id)}
          className="px-3 py-1.5 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
        >
          Full Dossier
        </a>
        {app.interviewId && (
          <a
            href={routes.recruiterInterviewReport(app.id)}
            className="px-3 py-1.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold"
          >
            Interview Report
          </a>
        )}
      </td>
    </tr>
  );

  return (
    <WorkspaceShell
      title={data ? `Applicants · ${data.jobTitle}` : "Applicant Screening"}
      subtitle="Authoritative Referral-First Ranking · 60.00% Fixed Qualification Threshold"
    >
      <div className="space-y-5">
        {/* Top Context & Actions */}
        <div className="bg-surface-card rounded-2xl border border-border-subtle p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Hatchling Applicant Cap · {data?.applicationCount ?? 0} /{" "}
              {data?.applicationCap ?? 20} Received
            </p>
            <p className="text-xs text-on-surface-variant">
              Qualified referrals appear first (sorted by weighted score), followed by qualified non-referrals (sorted by weighted score). Referral status never alters ATS scores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRefModal((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
            >
              <Ticket className="w-4 h-4 text-primary" />
              <span>Referral Codes ({referrals.length})</span>
            </button>
            <a
              href={jobId ? routes.recruiterInterviewSetup(jobId) : routes.recruiterJobs}
              className="px-3.5 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
            >
              Interview Setup
            </a>
            <a
              href={jobId ? routes.recruiterInterviews(jobId) : routes.recruiterJobs}
              className="px-3.5 py-2 rounded-lg bg-primary-container text-white text-xs font-bold hover:bg-primary"
            >
              Manage Invitations
            </a>
          </div>
        </div>

        {/* Referral Codes Quick Panel */}
        {showRefModal && (
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-base">Trusted Referral Codes</h2>
              <button
                type="button"
                onClick={() => setShowRefModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {referrals.map((r) => (
                <div
                  key={r.id}
                  className="px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-xs"
                >
                  <span className="font-mono font-bold text-primary">{r.code}</span> ·{" "}
                  <span>{r.referrerName}</span> ({r.usedCount} used)
                </div>
              ))}
            </div>
            <form onSubmit={handleCreateReferral} className="flex flex-wrap gap-2">
              <input
                required
                placeholder="Referrer Name"
                value={newRefName}
                onChange={(e) => setNewRefName(e.target.value)}
                className="px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-xs"
              />
              <input
                required
                type="email"
                placeholder="Referrer Email"
                value={newRefEmail}
                onChange={(e) => setNewRefEmail(e.target.value)}
                className="px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold"
              >
                Generate Code
              </button>
            </form>
          </div>
        )}

        {/* Exact Tie Alert Banner */}
        {data && data.tieGroups.length > 0 && (
          <div className="p-4 rounded-2xl bg-status-warning/12 border border-status-warning/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs">
              <Scale className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-on-surface">
                  Exact ATS Score Tie Detected — Human Recruiter Review Required
                </p>
                <p className="text-on-surface-variant mt-0.5">
                  {data.tieGroups
                    .map(
                      (t) =>
                        `${t.candidateNames.join(" & ")} tied at ${t.weightedScore.toFixed(
                          2
                        )}%`
                    )
                    .join(" · ")}
                </p>
              </div>
            </div>
            <a
              href={
                jobId
                  ? routes.recruiterTieReview(jobId, data.tieGroups[0].tieGroupKey)
                  : routes.recruiterJobs
              }
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-status-warning text-white text-xs font-bold"
            >
              <span>Review Tie Side-by-Side</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Tabs & Filters */}
        <div className="bg-surface-card rounded-2xl border border-border-subtle p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "qualified", label: `Qualified (${data?.counts.qualified ?? 0})` },
              { id: "not_qualified", label: `Not qualified (${data?.counts.notQualified ?? 0})` },
              { id: "needs_review", label: `Needs review (${data?.counts.needsReview ?? 0})` },
              { id: "failed", label: `Failed (${data?.counts.failed ?? 0})` },
              { id: "shortlisted", label: `Shortlisted (${data?.counts.shortlisted ?? 0})` },
              { id: "interview", label: `Interview (${data?.counts.interview ?? 0})` },
              { id: "all", label: `All (${data?.counts.all ?? 0})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  tab === t.id
                    ? "bg-primary-container text-white"
                    : "bg-paper-base text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <select
              value={referralFilter}
              onChange={(e) => {
                setReferralFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by referral"
              className="px-2.5 py-1.5 rounded-lg bg-paper-base border border-border-subtle font-semibold"
            >
              <option value="all">All sources</option>
              <option value="referred">Referrals only</option>
              <option value="non_referred">Non-referrals only</option>
            </select>
            {tab === "qualified" && (
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                aria-label="Sort qualified applicants"
                className="px-2.5 py-1.5 rounded-lg bg-paper-base border border-border-subtle font-semibold"
              >
                <option value="referral_then_score">
                  Default: Referrals first, then score
                </option>
                <option value="newest_alternate">Alternate: Newest submitted</option>
              </select>
            )}
          </div>
        </div>

        {/* Applicants Table(s) */}
        {loading ? (
          <div className="h-64 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
        ) : !data || data.items.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-10 text-center text-sm text-on-surface-variant">
            No applicants match this filter tab yet.
          </div>
        ) : tab === "qualified" && sortMode === "referral_then_score" ? (
          <div className="space-y-5">
            {/* Group 1: Referrals */}
            <div className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 bg-surface-container-low border-b border-border-subtle flex items-center justify-between">
                <h2 className="font-display font-bold text-sm text-primary">
                  Referrals ({referralItems.length})
                </h2>
                <span className="text-[11px] text-on-surface-variant">
                  Display priority group · Scored using the same 60% threshold
                </span>
              </div>
              {referralItems.length === 0 ? (
                <p className="p-5 text-xs text-on-surface-variant">
                  No qualified referred applicants on this page.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-paper-base text-xs font-bold text-on-surface-variant border-b border-border-subtle">
                        <th className="py-2.5 px-5">Candidate</th>
                        <th className="py-2.5 px-3">Source</th>
                        <th className="py-2.5 px-3">ATS Score</th>
                        <th className="py-2.5 px-3">Qualification</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {referralItems.map(renderApplicantRow)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Group 2: Other Qualified Applicants */}
            <div className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 bg-paper-base border-b border-border-subtle flex items-center justify-between">
                <h2 className="font-display font-bold text-sm text-on-surface">
                  Other Qualified Applicants ({otherQualifiedItems.length})
                </h2>
                <span className="text-[11px] text-on-surface-variant">
                  Sorted by weighted score descending
                </span>
              </div>
              {otherQualifiedItems.length === 0 ? (
                <p className="p-5 text-xs text-on-surface-variant">
                  No qualified non-referred applicants on this page.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-paper-base text-xs font-bold text-on-surface-variant border-b border-border-subtle">
                        <th className="py-2.5 px-5">Candidate</th>
                        <th className="py-2.5 px-3">Source</th>
                        <th className="py-2.5 px-3">ATS Score</th>
                        <th className="py-2.5 px-3">Qualification</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {otherQualifiedItems.map(renderApplicantRow)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-paper-base text-xs font-bold text-on-surface-variant border-b border-border-subtle">
                    <th className="py-2.5 px-5">Candidate</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">ATS Score</th>
                    <th className="py-2.5 px-3">Qualification</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {data.items.map(renderApplicantRow)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ATS Evidence Slide-Over Drawer */}
      {selectedApp && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-on-surface/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-surface-card h-full overflow-y-auto shadow-2xl p-6 sm:p-7 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display font-bold text-2xl text-on-surface">
                    {selectedApp.candidateName}
                  </h2>
                  {selectedApp.isReferral && <StatusBadge variant="referral" />}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {selectedApp.candidateEmail} · {selectedApp.resumeFilename}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="p-1.5 rounded-lg border border-border-subtle text-outline hover:text-on-surface"
                aria-label="Close evidence drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadResume(selectedApp.resumeFileId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
              >
                <Download className="w-4 h-4 text-primary" />
                <span>Download PDF (Signed URL)</span>
              </button>

              {selectedApp.screeningResult === "qualified" && (
                <button
                  type="button"
                  onClick={() => handleDecision(selectedApp.id, "shortlisted")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-container text-white text-xs font-bold"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Shortlist</span>
                </button>
              )}

              {(selectedApp.evaluationStatus === "failed" ||
                selectedApp.resumeProcessingStatus === "extraction_failed") && (
                <button
                  type="button"
                  onClick={() => handleRetryEval(selectedApp.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container text-primary text-xs font-bold"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Screening</span>
                </button>
              )}

              <a
                href={routes.recruiterCandidateDossier(selectedApp.id)}
                className="ml-auto text-xs font-bold text-primary hover:underline"
              >
                Open Full Dossier →
              </a>
            </div>

            {evalLoading ? (
              <p className="text-sm text-on-surface-variant">Loading ATS evidence...</p>
            ) : !selectedEval ? (
              <div className="p-4 rounded-xl bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {selectedApp.reviewFlags[0] ||
                    "No completed evaluation available yet. Failed extractions are never scored 0."}
                </span>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-surface-container-low border border-primary/15 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase text-primary flex items-center gap-1.5">
                      <FileSearch className="w-4 h-4" />
                      <span>Weighted ATS Score (Decision Support Only)</span>
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Profile v{selectedEval.jobEvaluationProfileVersion} · Rubric{" "}
                      {selectedEval.rubricVersion} · Threshold 60.00%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-2xl text-primary tabular-nums">
                      {selectedEval.weightedScore?.toFixed(2) ?? "—"}%
                    </p>
                    <StatusBadge
                      variant={
                        selectedEval.screeningResult === "qualified"
                          ? "qualified"
                          : "not_qualified"
                      }
                    />
                  </div>
                </div>

                {selectedEval.categoryEvaluations.map((cat) => (
                  <div
                    key={cat.category}
                    className="p-4 rounded-xl bg-paper-base border border-border-subtle space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-sm text-on-surface">
                        {RESUME_CATEGORY_LABELS[cat.category]} ({RESUME_WEIGHTS[cat.category]}%)
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase font-bold text-outline">
                          {cat.confidence} confidence
                        </span>
                        <span className="font-mono font-bold text-sm text-primary tabular-nums">
                          {cat.score}/100
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant">{cat.explanation}</p>
                    {cat.evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-surface-card border border-border-subtle text-xs"
                      >
                        <p className="font-semibold text-on-surface">{ev.description}</p>
                        {ev.excerpt && (
                          <p className="font-mono text-[11px] text-primary mt-1">
                            &ldquo;{ev.excerpt}&rdquo;{" "}
                            {ev.pageNumber ? `(Page ${ev.pageNumber})` : ""}
                          </p>
                        )}
                      </div>
                    ))}
                    {cat.limitations.length > 0 && (
                      <p className="text-[11px] text-status-warning">
                        Limitations: {cat.limitations.join("; ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
