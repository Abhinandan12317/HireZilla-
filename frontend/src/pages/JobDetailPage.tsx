import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Flag,
  MapPin,
  Users,
} from "lucide-react";
import type { JobPosting } from "../../../shared/types";
import { PublicFooter, PublicNavbar } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { getRouteParam, navigateTo, routes } from "../lib/navigation";

export function JobDetailPage() {
  const jobId = getRouteParam("jobId", /^\/jobs\/([^/]+)/);
  const { user, portfolio } = useAuth();
  const { pushToast } = useToast();

  const [job, setJob] = useState<JobPosting | null>(null);
  const [capReached, setCapReached] = useState(false);
  const [existingAppId, setExistingAppId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setError("Job identifier missing.");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    apiRequest<{
      job: JobPosting;
      capReached: boolean;
      existingApplicationId: string | null;
    }>(`/api/public/jobs/${encodeURIComponent(jobId)}`)
      .then((res) => {
        if (!active) return;
        setJob(res.job);
        setCapReached(res.capReached);
        setExistingAppId(res.existingApplicationId);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Job posting unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId]);

  const handleEasyApply = () => {
    if (!job) return;
    if (!user) {
      navigateTo(routes.login(routes.easyApply(job.id)));
      return;
    }
    if (user.role !== "student") {
      pushToast("info", "Only Student / Candidate accounts can submit job applications.");
      return;
    }
    if (!portfolio || !portfolio.displayName) {
      pushToast("info", "Complete your basic candidate profile first, then apply.");
      navigateTo(routes.studentOnboarding(routes.easyApply(job.id)));
      return;
    }
    navigateTo(routes.easyApply(job.id));
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    setSubmittingReport(true);
    try {
      await apiRequest(`/api/public/jobs/${job.id}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      pushToast("success", "Report submitted to HireZilla Trust & Safety.");
      setReportOpen(false);
      setReportReason("");
      setReportDetails("");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper-base">
      <PublicNavbar />

      <main className="flex-1 max-w-[1040px] w-full mx-auto px-4 sm:px-8 py-10">
        <a
          href={routes.jobs}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to all jobs</span>
        </a>

        {loading ? (
          <div className="h-80 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
        ) : error || !job ? (
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-10 text-center">
            <p className="font-display font-bold text-xl text-on-surface">
              {error || "Job not found"}
            </p>
            <a
              href={routes.jobs}
              className="inline-block mt-4 px-5 py-2.5 rounded-lg bg-primary-container text-white text-sm font-bold"
            >
              Browse Open Jobs
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-primary">{job.companyName}</span>
                  <StatusBadge variant="not_verified" />
                  {job.isDemo && <StatusBadge variant="demo" />}
                  <StatusBadge variant={job.status} />
                </div>
                <span className="text-xs text-outline tabular-nums">
                  Posted {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>

              <h1 className="font-display font-bold text-2xl sm:text-3xl text-on-surface">
                {job.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-surface-variant mt-3">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" />
                  {job.location} · {job.workMode}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-primary" />
                  {job.experienceLevel} · {job.employmentType.replace("_", " ")}
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Users className="w-4 h-4 text-primary" />
                  {job.applicationCount} / {job.applicationCap} Hatchling slots filled
                </span>
              </div>

              <div className="mt-6 pt-5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-4">
                <div>
                  {job.compensationDisplay && (
                    <p className="text-sm font-bold text-on-surface">
                      {job.compensationDisplay}
                    </p>
                  )}
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Company verification is not active in MVP (shown as Not verified).
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {existingAppId ? (
                    <a
                      href={routes.studentApplicationDetail(existingAppId)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-status-success/15 text-status-success font-bold text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Application submitted — View status</span>
                    </a>
                  ) : job.status !== "open" ? (
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2.5 rounded-xl bg-surface-container-high text-outline font-bold text-sm cursor-not-allowed"
                    >
                      Applications {job.status}
                    </button>
                  ) : capReached ? (
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2.5 rounded-xl bg-surface-container-high text-outline font-bold text-sm cursor-not-allowed"
                    >
                      Hatchling Cap Reached (20/20)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleEasyApply}
                      className="px-6 py-3 rounded-xl bg-primary-container text-white font-bold text-sm hover:bg-primary transition-colors shadow-sm"
                    >
                      Easy Apply
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-surface-card rounded-2xl border border-border-subtle p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="font-display font-bold text-lg text-on-surface mb-2">
                    About the Role
                  </h2>
                  <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                    {job.description}
                  </p>
                </div>

                {job.responsibilities.length > 0 && (
                  <div>
                    <h2 className="font-display font-bold text-lg text-on-surface mb-2">
                      Responsibilities
                    </h2>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-on-surface-variant">
                      {job.responsibilities.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h2 className="font-display font-bold text-lg text-on-surface mb-2">
                    Required Skills (Mandatory)
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {job.requiredSkills.map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1 rounded-lg bg-primary-fixed text-primary text-xs font-bold"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {job.preferredSkills.length > 0 && (
                  <div>
                    <h2 className="font-display font-bold text-lg text-on-surface mb-2">
                      Preferred Skills (Bonus)
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {job.preferredSkills.map((s) => (
                        <span
                          key={s}
                          className="px-3 py-1 rounded-lg bg-paper-base border border-border-subtle text-xs font-semibold text-on-surface-variant"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 space-y-5">
                <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 space-y-4">
                  <h2 className="font-display font-bold text-base text-on-surface">
                    Explicit Eligibility &amp; Education
                  </h2>
                  <div>
                    <p className="text-xs font-bold text-outline uppercase">Education</p>
                    <p className="text-sm text-on-surface mt-1">
                      {job.educationRequirement || "No strict degree specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-outline uppercase">
                      Job-Specific Eligibility
                    </p>
                    {job.eligibilityRequirements && job.eligibilityRequirements.length > 0 ? (
                      <ul className="mt-1 space-y-1 text-sm text-on-surface list-disc pl-4">
                        {job.eligibilityRequirements.map((req) => (
                          <li key={req}>{req}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-on-surface-variant mt-1">
                        None specified beyond standard role fit.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-surface-card rounded-2xl border border-border-subtle p-5">
                  <button
                    type="button"
                    onClick={() => setReportOpen((v) => !v)}
                    className="inline-flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-status-danger"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report job or company listing</span>
                  </button>

                  {reportOpen && (
                    <form onSubmit={handleSubmitReport} className="mt-4 space-y-3">
                      <div>
                        <label
                          htmlFor="report-reason"
                          className="block text-xs font-bold text-on-surface mb-1"
                        >
                          Reason <span className="text-status-danger">*</span>
                        </label>
                        <input
                          id="report-reason"
                          required
                          minLength={5}
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          placeholder="e.g. Misleading requirements or spam"
                          className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-xs"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="report-details"
                          className="block text-xs font-bold text-on-surface mb-1"
                        >
                          Details (optional)
                        </label>
                        <textarea
                          id="report-details"
                          rows={3}
                          value={reportDetails}
                          onChange={(e) => setReportDetails(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submittingReport}
                        className="w-full py-2 rounded-lg bg-status-danger text-white text-xs font-bold disabled:opacity-50"
                      >
                        {submittingReport ? "Submitting..." : "Submit Report"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

