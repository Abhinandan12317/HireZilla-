import { useEffect, useState } from "react";
import { ArrowRight, Briefcase, Building2, CheckCircle2, Lock, Users } from "lucide-react";
import type { Company, JobPosting } from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { apiRequest } from "../lib/api";
import { routes } from "../lib/navigation";

export function RecruiterDashboard() {
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalApplications: 0,
    qualifiedApplicants: 0,
    interviewsPendingReview: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{
      company: Company | null;
      jobs: JobPosting[];
      stats: {
        activeJobs: number;
        totalApplications: number;
        qualifiedApplicants: number;
        interviewsPendingReview: number;
      };
    }>("/api/recruiter/dashboard")
      .then((res) => {
        setCompany(res.company);
        setJobs(res.jobs);
        setStats(res.stats);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkspaceShell
      title="Recruiter Overview"
      subtitle={
        company
          ? `${company.name} · Not verified · Hatchling (Free)`
          : "Complete your company workspace to start hiring"
      }
    >
      {loading ? (
        <div className="h-72 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
      ) : !company ? (
        <div className="bg-surface-card rounded-2xl border border-border-subtle p-10 text-center max-w-xl mx-auto">
          <Building2 className="w-10 h-10 text-primary mx-auto mb-3" />
          <h2 className="font-display font-bold text-2xl text-on-surface">
            Set up your Company Profile first
          </h2>
          <p className="text-sm text-on-surface-variant mt-2">
            Create your company profile to activate the free Hatchling package and publish jobs.
          </p>
          <a
            href={routes.recruiterCompany}
            className="inline-block mt-5 px-6 py-3 rounded-xl bg-primary-container text-white text-sm font-bold"
          >
            Complete Company Profile
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Status Strip */}
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display font-bold text-lg text-on-surface">
                {company.name}
              </span>
              <StatusBadge variant="not_verified" />
              <span className="px-3 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold">
                Hatchling · Free
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <a
                href={routes.recruiterPackage}
                className="px-3.5 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
              >
                View Package
              </a>
              <a
                href={routes.recruiterJobNew}
                className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold hover:bg-primary"
              >
                + Create Job
              </a>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Active Jobs", val: stats.activeJobs, Icon: Briefcase },
              { label: "Applications Received", val: stats.totalApplications, Icon: Users },
              {
                label: "Qualified Applicants (≥60%)",
                val: stats.qualifiedApplicants,
                Icon: CheckCircle2,
              },
              {
                label: "Interview Stage",
                val: stats.interviewsPendingReview,
                Icon: ArrowRight,
              },
            ].map((kpi) => {
              const Icon = kpi.Icon;
              return (
                <div
                  key={kpi.label}
                  className="bg-surface-card rounded-2xl border border-border-subtle p-5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {kpi.label}
                    </span>
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="font-display font-bold text-3xl text-on-surface mt-2 tabular-nums">
                    {kpi.val}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Recent Jobs */}
            <div className="lg:col-span-8 bg-surface-card rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-on-surface">
                  Job Operations
                </h2>
                <a
                  href={routes.recruiterJobs}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Manage all jobs →
                </a>
              </div>

              {jobs.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-display font-bold text-base">No jobs created yet</p>
                  <a
                    href={routes.recruiterJobNew}
                    className="inline-block mt-3 px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold"
                  >
                    Create your first job
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-paper-base/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={routes.recruiterJobApplicants(job.id)}
                            className="font-display font-bold text-base text-on-surface hover:text-primary truncate"
                          >
                            {job.title}
                          </a>
                          <StatusBadge variant={job.status} />
                          {job.isDemo && <StatusBadge variant="demo" />}
                        </div>
                        <p className="text-xs text-on-surface-variant mt-1 tabular-nums">
                          {job.location} · {job.applicationCount}/{job.applicationCap}{" "}
                          applications · Profile v{job.activeEvaluationProfileVersion || "—"} (
                          {job.evaluationProfileStatus})
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <a
                          href={routes.recruiterJobApplicants(job.id)}
                          className="px-3 py-1.5 rounded-lg bg-primary-container text-white text-xs font-bold"
                        >
                          Applicants
                        </a>
                        <a
                          href={routes.recruiterInterviewSetup(job.id)}
                          className="px-3 py-1.5 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
                        >
                          Interview Setup
                        </a>
                        <a
                          href={routes.recruiterJobEdit(job.id)}
                          className="px-3 py-1.5 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
                        >
                          Edit
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hatchling Package Panel */}
            <div className="lg:col-span-4 bg-surface-card rounded-2xl border border-border-subtle p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-on-surface">
                  Hatchling Entitlements
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold">
                  Free
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2 text-on-surface">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>Up to 20 applications per job (atomic cap)</span>
                </li>
                <li className="flex items-center gap-2 text-on-surface">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>7-category AI resume evidence &amp; 60% gate</span>
                </li>
                <li className="flex items-center gap-2 text-on-surface">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>AI text-based technical interview</span>
                </li>
                <li className="flex items-center gap-2 text-outline">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>General Aptitude &amp; DSA (Planned in Titan)</span>
                </li>
                <li className="flex items-center gap-2 text-outline">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Cognitive Games (Planned in Colossus)</span>
                </li>
              </ul>
              <a
                href={routes.recruiterPackage}
                className="block w-full text-center py-2.5 rounded-lg border border-border-subtle text-xs font-bold text-primary hover:bg-surface-container-low"
              >
                Compare Packages
              </a>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
