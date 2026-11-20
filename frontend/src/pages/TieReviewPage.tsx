import React, { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Scale } from "lucide-react";
import {
  RESUME_CATEGORY_KEYS,
  RESUME_CATEGORY_LABELS,
  RESUME_WEIGHTS,
  TIE_REASON_CODES,
} from "../../../shared/constants";
import type {
  ApplicationRecord,
  JobPosting,
  ResumeEvaluationRecord,
} from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { apiRequest } from "../lib/api";
import { getRouteParam, navigateTo, routes } from "../lib/navigation";

interface TieDetailResponse {
  job: JobPosting;
  tieGroupKey: string;
  weightedScore: number;
  candidates: Array<{
    application: ApplicationRecord;
    evaluation: ResumeEvaluationRecord | null;
  }>;
}

export function TieReviewPage() {
  const rawJobId = getRouteParam("jobId", /^\/recruiter\/jobs\/([^/]+)/);
  const jobId = rawJobId && rawJobId !== "ties" ? rawJobId : undefined;
  const tieGroupKey = getRouteParam(
    "tieGroupKey",
    /^\/recruiter\/jobs\/[^/]+\/ties\/([^/]+)/,
    1
  );
  const { pushToast } = useToast();

  const [data, setData] = useState<TieDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<
    "selected_one" | "progress_both" | "not_proceeding_either"
  >("progress_both");
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [reasonCode, setReasonCode] = useState<string>(TIE_REASON_CODES[0].code);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!jobId || !tieGroupKey) {
      setLoading(false);
      return;
    }
    apiRequest<TieDetailResponse>(
      `/api/jobs/${encodeURIComponent(jobId)}/ties/${encodeURIComponent(tieGroupKey)}`
    )
      .then((res) => {
        setData(res);
        if (res.candidates[0]) setSelectedAppId(res.candidates[0].application.id);
      })
      .catch((err) =>
        pushToast("error", err instanceof Error ? err.message : "Tie group unavailable.")
      )
      .finally(() => setLoading(false));
  }, [jobId, tieGroupKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !jobId || !tieGroupKey) return;
    setSubmitting(true);
    try {
      await apiRequest(
        `/api/jobs/${encodeURIComponent(jobId)}/ties/${encodeURIComponent(tieGroupKey)}/resolve`,
        {
          method: "POST",
          body: JSON.stringify({
            outcome,
            selectedApplicationIds:
              outcome === "selected_one" && selectedAppId ? [selectedAppId] : [],
            reasonCode,
            note,
          }),
        }
      );
      pushToast("success", "Tie-break decision recorded and audited.");
      navigateTo(routes.recruiterJobApplicants(jobId));
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to record tie decision.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorkspaceShell
      title="ATS Score Tie — Recruiter Review Required"
      subtitle="Compare tied candidates side by side using job-related evidence only"
    >
      <div className="space-y-6">
        <a
          href={jobId ? routes.recruiterJobApplicants(jobId) : routes.recruiterJobs}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Applicants</span>
        </a>

        {loading ? (
          <div className="h-72 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
        ) : !data ? (
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-8 text-center">
            <p className="font-bold">No active tie group found for this score.</p>
          </div>
        ) : (
          <>
            <div className="p-5 rounded-2xl bg-surface-card border border-status-warning/40 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Scale className="w-6 h-6 text-status-warning shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display font-bold text-xl text-on-surface">
                    Identical Unrounded Score:{" "}
                    <span className="text-primary tabular-nums">
                      {data.weightedScore.toFixed(2)}%
                    </span>
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Referral status is shown only as factual metadata and must never determine tie outcome.
                  </p>
                </div>
              </div>
            </div>

            {/* Side-by-side 7-category comparison */}
            <div className="bg-surface-card rounded-2xl border border-border-subtle overflow-x-auto shadow-xs">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-paper-base border-b border-border-subtle">
                    <th className="py-4 px-5 text-xs font-bold uppercase text-outline w-56">
                      Rubric Category
                    </th>
                    {data.candidates.map((c) => (
                      <th key={c.application.id} className="py-4 px-5 min-w-[260px]">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-base text-on-surface">
                            {c.application.candidateName}
                          </span>
                          {c.application.isReferral && <StatusBadge variant="referral" />}
                        </div>
                        <p className="text-xs font-normal text-outline mt-0.5">
                          Submitted {new Date(c.application.submittedAt).toLocaleString()}
                        </p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {RESUME_CATEGORY_KEYS.map((catKey) => (
                    <tr key={catKey} className="align-top">
                      <td className="py-3.5 px-5 text-xs font-bold text-on-surface">
                        {RESUME_CATEGORY_LABELS[catKey]}
                        <span className="block font-mono text-[11px] text-outline">
                          Weight {RESUME_WEIGHTS[catKey]}%
                        </span>
                      </td>
                      {data.candidates.map((c) => {
                        const catEval = c.evaluation?.categoryEvaluations.find(
                          (e) => e.category === catKey
                        );
                        return (
                          <td key={c.application.id} className="py-3.5 px-5 text-xs space-y-1">
                            <p className="font-mono font-bold text-sm text-primary tabular-nums">
                              {catEval?.score ?? "—"}/100
                            </p>
                            {catEval && (
                              <p className="text-on-surface-variant">{catEval.explanation}</p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tie Decision Controls */}
            <form
              onSubmit={handleSubmit}
              className="bg-surface-card rounded-2xl border border-border-subtle p-6 space-y-4 shadow-xs"
            >
              <h3 className="font-display font-bold text-lg text-on-surface">
                Record Auditable Tie Outcome
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "progress_both", label: "Progress Both Candidates" },
                  { id: "selected_one", label: "Select One Candidate" },
                  { id: "not_proceeding_either", label: "Do Not Proceed Either" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setOutcome(
                        opt.id as
                          | "selected_one"
                          | "progress_both"
                          | "not_proceeding_either"
                      )
                    }
                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                      outcome === opt.id
                        ? "border-primary bg-primary-fixed text-primary"
                        : "border-border-subtle bg-paper-base text-on-surface-variant"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {outcome === "selected_one" && (
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Candidate to Progress
                  </label>
                  <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                  >
                    {data.candidates.map((c) => (
                      <option key={c.application.id} value={c.application.id}>
                        {c.application.candidateName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="tie-reason" className="block text-xs font-bold mb-1">
                  Required Job-Related Reason Code <span className="text-status-danger">*</span>
                </label>
                <select
                  id="tie-reason"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                >
                  {TIE_REASON_CODES.map((rc) => (
                    <option key={rc.code} value={rc.code}>
                      {rc.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tie-note" className="block text-xs font-bold mb-1">
                  Supporting Job-Related Note{" "}
                  {reasonCode === "other_job_related_reason" && (
                    <span className="text-status-danger">*</span>
                  )}
                </label>
                <textarea
                  id="tie-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Cite objective project, skill, or eligibility evidence (never protected attributes or referral status)."
                  className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-container text-white text-sm font-bold hover:bg-primary disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? "Recording..." : "Submit Tie Decision"}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}
