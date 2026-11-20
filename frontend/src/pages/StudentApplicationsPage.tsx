import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, FileText, PlayCircle } from "lucide-react";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { apiRequest } from "../lib/api";
import { getRouteParam, routes } from "../lib/navigation";

interface StudentAppListItem {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  companyVerificationStatus: string;
  location: string;
  workMode: string;
  resumeFilename: string;
  resumeProcessingStatus: string;
  evaluationStatus: string;
  applicationStatus: string;
  recruiterDecision: string;
  interviewToken: string | null;
  interviewDeadlineAt: string | null;
  submittedAt: string;
}

interface StudentAppDetail {
  application: {
    id: string;
    resumeFileId: string;
    resumeFilename: string;
    resumeProcessingStatus: string;
    evaluationStatus: string;
    applicationStatus: string;
    recruiterDecision: string;
    isReferral: boolean;
    submittedAt: string;
  };
  job: {
    id: string;
    title: string;
    companyName: string;
    companyVerificationStatus: string;
    location: string;
    workMode: string;
  } | null;
  resumeStatusNote: string | null;
  interviewInvitation: {
    id: string;
    status: string;
    token: string | null;
    durationMinutes: number;
    deadlineAt: string;
  } | null;
}

export function StudentApplicationsPage() {
  const applicationId = getRouteParam(
    "applicationId",
    /^\/student\/applications\/([^/]+)/
  );
  const [apps, setApps] = useState<StudentAppListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(applicationId ?? null);
  const [detail, setDetail] = useState<StudentAppDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ applications: StudentAppListItem[] }>("/api/student/applications")
      .then((res) => {
        setApps(res.applications);
        if (!selectedId && res.applications[0]) {
          setSelectedId(res.applications[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (applicationId) setSelectedId(applicationId);
  }, [applicationId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    apiRequest<StudentAppDetail>(`/api/student/applications/${selectedId}`)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [selectedId]);

  const timelineSteps = detail
    ? [
        {
          label: "Application Submitted",
          done: true,
          sub: new Date(detail.application.submittedAt).toLocaleString(),
        },
        {
          label: "Resume Extraction & Screening",
          done:
            detail.application.evaluationStatus === "completed" ||
            detail.application.evaluationStatus === "needs_review",
          failed:
            detail.application.resumeProcessingStatus === "extraction_failed" ||
            detail.application.evaluationStatus === "failed",
          sub:
            detail.application.resumeProcessingStatus === "extraction_failed"
              ? "Resume text extraction failed — see guidance below"
              : detail.application.evaluationStatus === "completed" ||
                  detail.application.evaluationStatus === "needs_review"
                ? "Screening processed; under hiring team review"
                : "Processing in progress",
        },
        {
          label: "AI Text Interview",
          done:
            detail.interviewInvitation?.status === "submitted" ||
            detail.interviewInvitation?.status === "report_ready",
          active:
            detail.interviewInvitation?.status === "invited" ||
            detail.interviewInvitation?.status === "in_progress",
          sub: detail.interviewInvitation
            ? `Status: ${detail.interviewInvitation.status.replace(/_/g, " ")}`
            : "Invited if shortlisted by recruiter",
        },
        {
          label: "Recruiter Decision",
          done:
            detail.application.recruiterDecision === "selected" ||
            detail.application.recruiterDecision === "not_selected",
          sub: detail.application.recruiterDecision.replace(/_/g, " "),
        },
      ]
    : [];

  return (
    <WorkspaceShell
      title="My Applications"
      subtitle="Transparent progress tracker — private recruiter scoring notes are never exposed"
    >
      {loading ? (
        <div className="h-72 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
      ) : apps.length === 0 ? (
        <div className="bg-surface-card rounded-2xl border border-border-subtle p-12 text-center">
          <FileText className="w-10 h-10 text-outline mx-auto mb-2" />
          <p className="font-display font-bold text-xl">No applications submitted yet</p>
          <a
            href={routes.jobs}
            className="inline-block mt-4 px-5 py-2.5 rounded-lg bg-primary-container text-white text-sm font-bold"
          >
            Browse Open Jobs
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Master List */}
          <div className="lg:col-span-5 space-y-3">
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedId(app.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  selectedId === app.id
                    ? "bg-surface-card border-primary shadow-sm ring-1 ring-primary/20"
                    : "bg-surface-card border-border-subtle hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-primary">{app.companyName}</span>
                  <StatusBadge variant="not_verified" />
                </div>
                <p className="font-display font-bold text-base text-on-surface">
                  {app.jobTitle}
                </p>
                <div className="flex items-center justify-between mt-2 text-xs text-on-surface-variant">
                  <span className="capitalize">
                    {app.applicationStatus.replace(/_/g, " ")}
                  </span>
                  <span className="tabular-nums">
                    {new Date(app.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Right Detail Pane */}
          <div className="lg:col-span-7 bg-surface-card rounded-2xl border border-border-subtle p-6 sm:p-7 shadow-xs">
            {!detail ? (
              <p className="text-sm text-on-surface-variant">Select an application to view details.</p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-border-subtle">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">
                        {detail.job?.companyName}
                      </span>
                      <StatusBadge variant="not_verified" />
                      {detail.application.isReferral && <StatusBadge variant="referral" />}
                    </div>
                    <h2 className="font-display font-bold text-2xl text-on-surface mt-1">
                      {detail.job?.title}
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Submitted resume:{" "}
                      <strong className="text-on-surface">
                        {detail.application.resumeFilename}
                      </strong>
                    </p>
                  </div>
                </div>

                {detail.resumeStatusNote && (
                  <div className="p-4 rounded-xl bg-status-danger/10 border border-status-danger/30 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-status-danger shrink-0 mt-0.5" />
                    <div className="text-xs text-on-surface space-y-1">
                      <p className="font-bold text-status-danger">
                        Resume Extraction Issue
                      </p>
                      <p>{detail.resumeStatusNote}</p>
                    </div>
                  </div>
                )}

                {detail.interviewInvitation?.token && (
                  <div className="p-5 rounded-xl bg-tertiary-fixed/35 border border-tertiary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-display font-bold text-base text-on-surface">
                        You&apos;re invited to the AI Text Interview
                      </p>
                      <p className="text-xs text-on-surface-variant mt-0.5 tabular-nums">
                        Time limit: {detail.interviewInvitation.durationMinutes} mins ·
                        Deadline:{" "}
                        {new Date(detail.interviewInvitation.deadlineAt).toLocaleString()}
                      </p>
                    </div>
                    <a
                      href={routes.interview(detail.interviewInvitation.token)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold hover:bg-primary shrink-0"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Start Interview</span>
                    </a>
                  </div>
                )}

                {/* Progress Timeline */}
                <div>
                  <h3 className="font-display font-bold text-base text-on-surface mb-4">
                    Application Progress Timeline
                  </h3>
                  <div className="space-y-4">
                    {timelineSteps.map((st) => (
                      <div key={st.label} className="flex items-start gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            st.failed
                              ? "bg-status-danger/15 text-status-danger"
                              : st.done
                                ? "bg-status-success/15 text-status-success"
                                : st.active
                                  ? "bg-primary-fixed text-primary"
                                  : "bg-paper-base text-outline"
                          }`}
                        >
                          {st.failed ? (
                            <AlertCircle className="w-4 h-4" />
                          ) : st.done ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface">{st.label}</p>
                          <p className="text-xs text-on-surface-variant capitalize">{st.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
