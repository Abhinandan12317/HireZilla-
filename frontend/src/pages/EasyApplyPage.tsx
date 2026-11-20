import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { JobPosting } from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiRequest } from "../lib/api";
import { getRouteParam, navigateTo, routes } from "../lib/navigation";

export function EasyApplyPage() {
  const jobId = getRouteParam("jobId", /^\/jobs\/([^/]+)/);
  const { portfolio } = useAuth();
  const { pushToast } = useToast();

  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setFormError("Job identifier missing.");
      setLoading(false);
      return;
    }
    apiRequest<{ job: JobPosting }>(`/api/public/jobs/${encodeURIComponent(jobId)}`)
      .then((res) => setJob(res.job))
      .catch((err) => setFormError(err instanceof Error ? err.message : "Job unavailable."))
      .finally(() => setLoading(false));
  }, [jobId]);

  const submitApplication = async (continueWithoutReferral: boolean) => {
    if (!job) return;
    if (!file) {
      setFormError("Please select a PDF resume file.");
      return;
    }
    if (!consentChecked) {
      setFormError("Please acknowledge the AI-assisted screening consent notice.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setReferralError(null);

    const fd = new FormData();
    fd.append("resume", file);
    if (coverLetter.trim()) fd.append("coverLetter", coverLetter.trim());
    if (referralCode.trim() && !continueWithoutReferral) {
      fd.append("referralCode", referralCode.trim());
    }
    if (continueWithoutReferral) {
      fd.append("continueWithoutReferral", "true");
    }

    try {
      const res = await apiRequest<{
        application: { id: string };
        resumeProcessingStatus: string;
        failureMessageSafe: string | null;
      }>(`/api/jobs/${job.id}/apply`, {
        method: "POST",
        body: fd,
      });

      if (res.resumeProcessingStatus === "extraction_failed") {
        pushToast(
          "info",
          res.failureMessageSafe ||
            "Application submitted, but resume extraction failed. Check details."
        );
      } else {
        pushToast("success", "Application submitted successfully!");
      }
      navigateTo(routes.studentApplicationDetail(res.application.id));
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_REFERRAL") {
        setReferralError(err.message);
      } else if (err instanceof ApiError && err.code === "DUPLICATE_APPLICATION") {
        const existingId = (err.data as { existingApplicationId?: string })
          ?.existingApplicationId;
        pushToast("info", "You have already applied to this role.");
        if (existingId) navigateTo(routes.studentApplicationDetail(existingId));
      } else {
        setFormError(err instanceof Error ? err.message : "Submission failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitApplication(false);
  };

  return (
    <WorkspaceShell
      title="Easy Apply"
      subtitle={job ? `${job.title} · ${job.companyName}` : "Submit your application"}
    >
      <div className="max-w-3xl space-y-6">
        <a
          href={job ? routes.jobDetail(job.id) : routes.jobs}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to job details</span>
        </a>

        {loading ? (
          <div className="h-64 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
        ) : !job ? (
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-8 text-center">
            <p className="font-bold text-status-danger">{formError || "Job not found."}</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-surface-card rounded-2xl border border-border-subtle p-6 sm:p-8 space-y-6 shadow-xs"
          >
            {/* Job Strip */}
            <div className="p-4 rounded-xl bg-paper-base border border-border-subtle flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">{job.companyName}</span>
                  <StatusBadge variant="not_verified" />
                </div>
                <h2 className="font-display font-bold text-lg text-on-surface mt-0.5">
                  {job.title}
                </h2>
              </div>
              <span className="text-xs font-bold text-on-surface-variant tabular-nums">
                {job.applicationCount}/{job.applicationCap} Hatchling slots used
              </span>
            </div>

            {/* Portfolio Link Summary */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-primary/15 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-primary">Attached Candidate Profile</p>
                <p className="text-sm font-semibold text-on-surface">
                  {portfolio?.displayName || "Profile incomplete"}{" "}
                  {portfolio?.visibility === "public" && (
                    <span className="font-mono text-xs text-outline">
                      (/p/{portfolio.slug})
                    </span>
                  )}
                </p>
              </div>
              <a
                href={routes.studentOnboarding()}
                className="text-xs font-bold text-primary hover:underline"
              >
                Edit Portfolio
              </a>
            </div>

            {/* PDF Resume Upload */}
            <div>
              <label className="block text-sm font-bold text-on-surface mb-1.5">
                Resume (PDF Only, max 5 MB / 10 pages){" "}
                <span className="text-status-danger">*</span>
              </label>

              {!file ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-xl p-8 bg-paper-base cursor-pointer hover:border-primary transition-colors">
                  <FileUp className="w-8 h-8 text-primary mb-2" />
                  <span className="text-sm font-bold text-on-surface">
                    Click to select your PDF resume
                  </span>
                  <span className="text-xs text-on-surface-variant mt-1">
                    Text-selectable PDF required · Validated by magic bytes on server
                  </span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const picked = e.target.files?.[0] ?? null;
                      setFile(picked);
                      setFormError(null);
                    }}
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-xl bg-paper-base border border-primary/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-on-surface-variant tabular-nums">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-status-danger hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              )}
            </div>

            {/* Optional Cover Letter */}
            <div>
              <label
                htmlFor="apply-cover"
                className="block text-sm font-bold text-on-surface mb-1"
              >
                Cover Letter <span className="text-xs font-normal text-outline">(Optional)</span>
              </label>
              <textarea
                id="apply-cover"
                rows={4}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Share brief context on why this role aligns with your projects..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-paper-base border border-border-subtle text-sm"
              />
            </div>

            {/* Optional Referral Code */}
            <div>
              <label
                htmlFor="apply-ref"
                className="block text-sm font-bold text-on-surface mb-1"
              >
                Referral Code <span className="text-xs font-normal text-outline">(Optional)</span>
              </label>
              <input
                id="apply-ref"
                value={referralCode}
                onChange={(e) => {
                  setReferralCode(e.target.value);
                  setReferralError(null);
                }}
                placeholder="e.g. #REF-8891"
                className="w-full px-3.5 py-2.5 rounded-xl bg-paper-base border border-border-subtle text-sm font-mono"
              />
              <p className="text-xs text-on-surface-variant mt-1">
                Referral status is optional and never changes your ATS score or 60% qualification threshold.
              </p>

              {referralError && (
                <div className="mt-3 p-3.5 rounded-xl bg-status-warning/12 border border-status-warning/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2 text-xs text-on-surface">
                    <AlertCircle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
                    <span>{referralError}</span>
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => submitApplication(true)}
                    className="shrink-0 px-3.5 py-1.5 rounded-lg bg-primary-container text-white text-xs font-bold"
                  >
                    Continue without referral
                  </button>
                </div>
              )}
            </div>

            {/* Consent Notice */}
            <label className="flex items-start gap-3 p-4 rounded-xl bg-paper-base border border-border-subtle cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary"
              />
              <span className="text-xs text-on-surface-variant leading-relaxed">
                <strong className="text-on-surface">AI-Assisted Screening Notice:</strong> I consent to private PDF resume storage and AI-assisted rubric evaluation against this job&apos;s criteria. A human recruiter remains responsible for all hiring decisions.
              </span>
            </label>

            {formError && (
              <div className="p-3.5 rounded-xl bg-status-danger/10 border border-status-danger/30 text-xs font-semibold text-status-danger">
                {formError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-container text-white text-sm font-bold hover:bg-primary disabled:opacity-60"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submitting ? "Submitting & Screening..." : "Submit Application"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </WorkspaceShell>
  );
}
