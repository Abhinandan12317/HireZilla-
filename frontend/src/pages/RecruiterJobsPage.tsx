import { useEffect, useState } from "react";
import { Briefcase, Plus } from "lucide-react";
import type { JobPosting } from "../../../shared/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { apiRequest } from "../lib/api";
import { routes } from "../lib/navigation";

export function RecruiterJobsPage() {
  const { pushToast } = useToast();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<{
    job: JobPosting;
    nextStatus: "open" | "paused" | "closed";
  } | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadJobs = () => {
    setLoading(true);
    apiRequest<{ jobs: JobPosting[] }>("/api/recruiter/jobs")
      .then((res) => setJobs(res.jobs))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const confirmStatusChange = async () => {
    if (!pendingAction) return;
    setUpdating(true);
    try {
      await apiRequest(`/api/recruiter/jobs/${pendingAction.job.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: pendingAction.nextStatus }),
      });
      pushToast(
        "success",
        `Job marked as ${pendingAction.nextStatus}. Existing applications remain accessible.`
      );
      setPendingAction(null);
      loadJobs();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to update job status.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <WorkspaceShell
      title="Job Postings"
      subtitle="Manage Hatchling 20-applicant jobs, evaluation profiles, and interview pipelines"
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-on-surface-variant">
            Total postings: <strong className="tabular-nums">{jobs.length}</strong>
          </p>
          <a
            href={routes.recruiterJobNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container text-white text-xs font-bold hover:bg-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Create Job</span>
          </a>
        </div>

        {loading ? (
          <div className="h-56 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
        ) : jobs.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-12 text-center">
            <Briefcase className="w-10 h-10 text-outline mx-auto mb-2" />
            <p className="font-display font-bold text-lg">No jobs created yet</p>
            <a
              href={routes.recruiterJobNew}
              className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold"
            >
              Create your first job
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-surface-card rounded-2xl border border-border-subtle p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display font-bold text-lg text-on-surface">
                      {job.title}
                    </h2>
                    <StatusBadge variant={job.status} />
                    {job.isDemo && <StatusBadge variant="demo" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant mt-1.5 tabular-nums">
                    <span>
                      {job.location} ({job.workMode})
                    </span>
                    <span>
                      Applicants: <strong>{job.applicationCount}</strong> / {job.applicationCap}
                    </span>
                    <span>
                      Profile: v{job.activeEvaluationProfileVersion || "—"} (
                      {job.evaluationProfileStatus})
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={routes.recruiterJobApplicants(job.id)}
                    className="px-3.5 py-2 rounded-lg bg-primary-container text-white text-xs font-bold"
                  >
                    Applicants ({job.applicationCount})
                  </a>
                  <a
                    href={routes.recruiterInterviewSetup(job.id)}
                    className="px-3 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
                  >
                    Interview Setup
                  </a>
                  <a
                    href={routes.recruiterInterviews(job.id)}
                    className="px-3 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
                  >
                    Invitations
                  </a>
                  <a
                    href={routes.recruiterJobEdit(job.id)}
                    className="px-3 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
                  >
                    Edit
                  </a>

                  {job.status === "open" && (
                    <button
                      type="button"
                      onClick={() => setPendingAction({ job, nextStatus: "paused" })}
                      className="px-3 py-2 rounded-lg border border-status-warning/40 text-status-warning text-xs font-bold hover:bg-status-warning/10"
                    >
                      Pause
                    </button>
                  )}
                  {job.status === "paused" && (
                    <button
                      type="button"
                      onClick={() => setPendingAction({ job, nextStatus: "open" })}
                      className="px-3 py-2 rounded-lg border border-status-success/40 text-status-success text-xs font-bold hover:bg-status-success/10"
                    >
                      Reopen
                    </button>
                  )}
                  {(job.status === "open" || job.status === "paused") && (
                    <button
                      type="button"
                      onClick={() => setPendingAction({ job, nextStatus: "closed" })}
                      className="px-3 py-2 rounded-lg border border-status-danger/40 text-status-danger text-xs font-bold hover:bg-status-danger/10"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={`Mark job as ${pendingAction?.nextStatus}?`}
        consequence={
          pendingAction?.nextStatus === "closed"
            ? "Closing this job permanently stops new applications and cannot be reopened. All existing applications and evaluations remain accessible."
            : "Changing job status updates applicant intake immediately. All existing applications remain preserved."
        }
        danger={pendingAction?.nextStatus === "closed"}
        loading={updating}
        onConfirm={confirmStatusChange}
        onCancel={() => setPendingAction(null)}
      />
    </WorkspaceShell>
  );
}
