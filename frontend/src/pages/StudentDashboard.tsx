import { useEffect, useState } from "react";
import { ArrowRight, Briefcase, ExternalLink, FileText, FolderKanban } from "lucide-react";
import type { StudentPortfolio } from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { routes } from "../lib/navigation";

interface StudentAppItem {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  companyVerificationStatus: string;
  resumeFilename: string;
  resumeProcessingStatus: string;
  evaluationStatus: string;
  applicationStatus: string;
  recruiterDecision: string;
  interviewToken: string | null;
  submittedAt: string;
}

export function StudentDashboard() {
  const { user, portfolio: authPortfolio } = useAuth();
  const [portfolio, setPortfolio] = useState<StudentPortfolio | null>(authPortfolio);
  const [completedCount, setCompletedCount] = useState(0);
  const [counts, setCounts] = useState({
    submitted: 0,
    screening: 0,
    invited: 0,
    interviewDone: 0,
    decisionPending: 0,
  });
  const [apps, setApps] = useState<StudentAppItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{
      portfolio: StudentPortfolio | null;
      portfolioCompleteness: { completedSteps: number; totalSteps: number };
      counts: typeof counts;
      applications: StudentAppItem[];
    }>("/api/student/dashboard")
      .then((res) => {
        setPortfolio(res.portfolio ?? authPortfolio);
        setCompletedCount(res.portfolioCompleteness.completedSteps);
        setCounts(res.counts);
        setApps(res.applications);
      })
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkspaceShell
      title={`Welcome back, ${user?.name || "Candidate"}`}
      subtitle="Candidate Workspace · Portfolio & Application Tracker"
    >
      <div className="space-y-6">
        {/* Top Portfolio Guidance Banner */}
        <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Portfolio Readiness Guidance
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-surface-container text-primary tabular-nums">
                {completedCount}/5 sections filled
              </span>
            </div>
            <h2 className="font-display font-bold text-xl text-on-surface mt-1">
              {portfolio?.visibility === "public"
                ? `Your portfolio is live at /p/${portfolio.slug}`
                : "Finish your skills & projects portfolio before applying"}
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">
              Guidance only — this completeness indicator is not a hiring score.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {portfolio?.visibility === "public" && (
              <a
                href={routes.portfolio(portfolio.slug)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
              >
                <span>View Public Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <a
              href={routes.studentOnboarding()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container text-primary text-xs font-bold hover:bg-primary-fixed"
            >
              <FolderKanban className="w-4 h-4" />
              <span>Edit Portfolio</span>
            </a>
            <a
              href={routes.jobs}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold hover:bg-primary"
            >
              <Briefcase className="w-4 h-4" />
              <span>Find Jobs</span>
            </a>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Submitted", val: counts.submitted },
            { label: "Screening in Progress", val: counts.screening },
            { label: "Interview Invited", val: counts.invited },
            { label: "Interview Completed", val: counts.interviewDone },
            { label: "Decision Pending", val: counts.decisionPending },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-surface-card rounded-xl border border-border-subtle p-4 shadow-xs"
            >
              <p className="text-xs font-semibold text-on-surface-variant">{c.label}</p>
              <p className="font-display font-bold text-2xl text-on-surface mt-1 tabular-nums">
                {c.val}
              </p>
            </div>
          ))}
        </div>

        {/* Recent Applications */}
        <div className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-on-surface">
              Recent Applications
            </h2>
            <a
              href={routes.studentApplications}
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Open Tracker</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-on-surface-variant">
              Loading applications...
            </div>
          ) : apps.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-10 h-10 text-outline mx-auto mb-2" />
              <p className="font-display font-bold text-base text-on-surface">
                You haven&apos;t applied yet
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Explore open jobs and submit your PDF resume to get started.
              </p>
              <a
                href={routes.jobs}
                className="inline-block mt-4 px-5 py-2.5 rounded-lg bg-primary-container text-white text-xs font-bold"
              >
                Browse Jobs
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-paper-base text-xs font-bold text-on-surface-variant border-b border-border-subtle">
                    <th className="py-3 px-5">Job Title</th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Applied Date</th>
                    <th className="py-3 px-4">Application Status</th>
                    <th className="py-3 px-4">Resume Processing</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {apps.map((app) => (
                    <tr key={app.id} className="hover:bg-paper-base/60">
                      <td className="py-3.5 px-5 font-semibold text-on-surface">
                        {app.jobTitle}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span>{app.companyName}</span>
                          <StatusBadge variant="not_verified" />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-on-surface-variant tabular-nums">
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold capitalize text-on-surface">
                          {app.applicationStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          variant={
                            app.resumeProcessingStatus === "extracted"
                              ? "qualified"
                              : app.resumeProcessingStatus === "extraction_failed"
                                ? "failed"
                                : "processing"
                          }
                          customLabel={app.resumeProcessingStatus.replace(/_/g, " ")}
                        />
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-2 whitespace-nowrap">
                        {app.interviewToken && (
                          <a
                            href={routes.interview(app.interviewToken)}
                            className="px-3 py-1.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold"
                          >
                            Start Interview
                          </a>
                        )}
                        <a
                          href={routes.studentApplicationDetail(app.id)}
                          className="px-3 py-1.5 rounded-lg border border-border-subtle text-xs font-bold text-primary hover:bg-surface-container-low"
                        >
                          Details
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
