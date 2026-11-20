import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import type {
  ApplicationRecord,
  InterviewQuestion,
  InterviewQuestionSet,
  InterviewSession,
  JobPosting,
} from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { apiRequest } from "../lib/api";
import { getRouteParam, routes } from "../lib/navigation";

export function InterviewSetupPage() {
  const rawJobId = getRouteParam("jobId", /^\/recruiter\/jobs\/([^/]+)/);
  const jobId =
    rawJobId && rawJobId !== "interview-setup" && rawJobId !== "interviews"
      ? rawJobId
      : undefined;
  const { pushToast } = useToast();
  const isInvitationsView = window.location.pathname.replace(/\/+$/, "").endsWith("/interviews");

  const [job, setJob] = useState<JobPosting | null>(null);
  const [questionSet, setQuestionSet] = useState<InterviewQuestionSet | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [eligibleApps, setEligibleApps] = useState<ApplicationRecord[]>([]);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [deadlineAt, setDeadlineAt] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [inviting, setInviting] = useState(false);

  const loadAll = async () => {
    if (!jobId) return;
    try {
      const [setupRes, invRes] = await Promise.all([
        apiRequest<{ job: JobPosting; questionSet: InterviewQuestionSet | null }>(
          `/api/recruiter/jobs/${jobId}/interview-setup`
        ),
        apiRequest<{
          sessions: InterviewSession[];
          eligibleShortlisted: ApplicationRecord[];
        }>(`/api/recruiter/jobs/${jobId}/interviews`),
      ]);
      setJob(setupRes.job);
      setQuestionSet(setupRes.questionSet);
      if (setupRes.questionSet) {
        setQuestions(setupRes.questionSet.questions);
        setDurationMinutes(setupRes.questionSet.durationMinutes);
      } else if (questions.length === 0) {
        setQuestions([
          {
            id: "q_1",
            prompt: "",
            competency: "Architecture & Systems",
            rubricSignals: ["Trade-off analysis", "Reliability"],
          },
          {
            id: "q_2",
            prompt: "",
            competency: "Debugging & Diagnostics",
            rubricSignals: ["Root cause triage"],
          },
          {
            id: "q_3",
            prompt: "",
            competency: "Implementation Rigor",
            rubricSignals: ["Edge case handling"],
          },
        ]);
      }
      setSessions(invRes.sessions);
      setEligibleApps(invRes.eligibleShortlisted);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to load setup.");
    }
  };

  useEffect(() => {
    loadAll();
  }, [jobId]);

  const handleGenerateQuestions = async () => {
    if (!jobId) return;
    setGenerating(true);
    try {
      const res = await apiRequest<{ questions: InterviewQuestion[] }>(
        `/api/recruiter/jobs/${jobId}/interview-setup/generate`,
        { method: "POST", body: JSON.stringify({ count: 5 }) }
      );
      setQuestions(res.questions);
      pushToast("success", "Generated 5 tailored interview prompts with Gemini.");
    } catch (err) {
      pushToast(
        "error",
        err instanceof Error
          ? err.message
          : "AI generation failed — you can edit/author questions manually."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSet = async (status: "draft" | "published") => {
    if (!jobId) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ questionSet: InterviewQuestionSet }>(
        `/api/recruiter/jobs/${jobId}/interview-setup`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
            durationMinutes,
            questions,
          }),
        }
      );
      setQuestionSet(res.questionSet);
      pushToast(
        "success",
        status === "published"
          ? `Question set v${res.questionSet.version} published! You can now invite shortlisted candidates.`
          : "Draft question set saved."
      );
      loadAll();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to save question set.");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!jobId || selectedAppIds.length === 0) return;
    setInviting(true);
    try {
      const res = await apiRequest<{ invitations: InterviewSession[] }>(
        `/api/recruiter/jobs/${jobId}/interviews/invite`,
        {
          method: "POST",
          body: JSON.stringify({
            applicationIds: selectedAppIds,
            deadlineAt: new Date(deadlineAt).toISOString(),
            durationMinutes,
          }),
        }
      );
      pushToast(
        "success",
        `Invited ${res.invitations.length} candidate(s) and queued HireZilla invitation emails.`
      );
      setSelectedAppIds([]);
      loadAll();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Invitation failed.");
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (interviewId: string) => {
    try {
      await apiRequest(`/api/recruiter/interviews/${interviewId}/resend`, {
        method: "POST",
      });
      pushToast("success", "Invitation email resent.");
      loadAll();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Resend failed.");
    }
  };

  const handleRevoke = async (interviewId: string) => {
    try {
      await apiRequest(`/api/recruiter/interviews/${interviewId}/revoke`, {
        method: "POST",
      });
      pushToast("info", "Interview invitation revoked.");
      loadAll();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Revoke failed.");
    }
  };

  return (
    <WorkspaceShell
      title={job ? `AI Text Interview · ${job.title}` : "AI Text Interview Setup"}
      subtitle="Hatchling Included Assessment · Configure scenario prompts, time limit, deadline & invitations"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            href={jobId ? routes.recruiterJobApplicants(jobId) : routes.recruiterJobs}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Applicants</span>
          </a>

          <div className="flex gap-2">
            <a
              href={jobId ? routes.recruiterInterviewSetup(jobId) : routes.recruiterJobs}
              className={`px-4 py-2 rounded-lg text-xs font-bold ${
                !isInvitationsView
                  ? "bg-primary-container text-white"
                  : "bg-surface-card border border-border-subtle text-on-surface"
              }`}
            >
              1. Question Setup
            </a>
            <a
              href={jobId ? routes.recruiterInterviews(jobId) : routes.recruiterJobs}
              className={`px-4 py-2 rounded-lg text-xs font-bold ${
                isInvitationsView
                  ? "bg-primary-container text-white"
                  : "bg-surface-card border border-border-subtle text-on-surface"
              }`}
            >
              2. Invitations ({sessions.length})
            </a>
          </div>
        </div>

        {!isInvitationsView ? (
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 space-y-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border-subtle">
              <div>
                <h2 className="font-display font-bold text-xl">
                  Scenario Question Set (v{questionSet?.version || 1} ·{" "}
                  {questionSet?.status || "draft"})
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Minimum 3 questions, maximum 8. Assessment duration is separate from candidate completion deadline.
                </p>
              </div>
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateQuestions}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container text-primary text-xs font-bold hover:bg-primary-fixed disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{generating ? "Generating..." : "Regenerate with Gemini"}</span>
              </button>
            </div>

            <div className="max-w-xs">
              <label htmlFor="int-duration" className="block text-xs font-bold mb-1">
                Assessment Time Limit (Minutes)
              </label>
              <input
                id="int-duration"
                type="number"
                min={10}
                max={120}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm tabular-nums"
              />
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-paper-base border border-border-subtle space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">
                      Scenario Question {idx + 1}
                    </span>
                    {questions.length > 3 && (
                      <button
                        type="button"
                        onClick={() =>
                          setQuestions((prev) => prev.filter((x) => x.id !== q.id))
                        }
                        className="text-xs font-bold text-status-danger inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                  <input
                    placeholder="Competency focus (e.g. Concurrency & Backpressure)"
                    value={q.competency}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((x) =>
                          x.id === q.id ? { ...x, competency: e.target.value } : x
                        )
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs font-semibold"
                  />
                  <textarea
                    rows={3}
                    placeholder="Scenario prompt..."
                    value={q.prompt}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((x) =>
                          x.id === q.id ? { ...x, prompt: e.target.value } : x
                        )
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-sm"
                  />
                  <input
                    placeholder="Rubric signals (comma-separated)"
                    value={q.rubricSignals.join(", ")}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((x) =>
                          x.id === q.id
                            ? {
                                ...x,
                                rubricSignals: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              }
                            : x
                        )
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                  />
                </div>
              ))}

              {questions.length < 8 && (
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((prev) => [
                      ...prev,
                      {
                        id: `q_${Date.now()}`,
                        prompt: "",
                        competency: "",
                        rubricSignals: ["Structured reasoning"],
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface"
                >
                  <Plus className="w-4 h-4" /> Add Question
                </button>
              )}
            </div>

            <div className="pt-4 border-t border-border-subtle flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveSet("draft")}
                className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs font-bold"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveSet("published")}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saving ? "Publishing..." : "Publish Question Set"}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invite Shortlisted Candidates */}
            <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 space-y-4 shadow-xs">
              <h2 className="font-display font-bold text-lg text-on-surface">
                Invite Shortlisted Qualified Candidates
              </h2>

              {questionSet?.status !== "published" && (
                <p className="text-xs font-bold text-status-warning">
                  Publish a question set in Step 1 before sending invitations.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inv-deadline" className="block text-xs font-bold mb-1">
                    Completion Deadline (UTC/Local)
                  </label>
                  <input
                    id="inv-deadline"
                    type="datetime-local"
                    value={deadlineAt}
                    onChange={(e) => setDeadlineAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                  />
                </div>
              </div>

              {eligibleApps.length === 0 ? (
                <p className="text-xs text-on-surface-variant">
                  No shortlisted candidates available yet. Shortlist qualified candidates from the Applicants list first.
                </p>
              ) : (
                <div className="space-y-2">
                  {eligibleApps.map((app) => (
                    <label
                      key={app.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-paper-base border border-border-subtle cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAppIds.includes(app.id)}
                          onChange={(e) => {
                            setSelectedAppIds((prev) =>
                              e.target.checked
                                ? [...prev, app.id]
                                : prev.filter((id) => id !== app.id)
                            );
                          }}
                          className="w-4 h-4 accent-primary"
                        />
                        <div>
                          <p className="text-sm font-bold text-on-surface">
                            {app.candidateName}
                          </p>
                          <p className="text-xs text-outline">{app.candidateEmail}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-primary">
                        {app.weightedScore?.toFixed(2)}%
                      </span>
                    </label>
                  ))}

                  <button
                    type="button"
                    disabled={
                      inviting ||
                      selectedAppIds.length === 0 ||
                      questionSet?.status !== "published"
                    }
                    onClick={handleInvite}
                    className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {inviting
                        ? "Sending Invitations..."
                        : `Invite Selected (${selectedAppIds.length})`}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Active Invitations Table */}
            <div className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-border-subtle">
                <h2 className="font-display font-bold text-lg text-on-surface">
                  Interview Invitations &amp; Submissions
                </h2>
              </div>
              {sessions.length === 0 ? (
                <p className="p-6 text-sm text-on-surface-variant">
                  No interview invitations sent yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-paper-base text-xs font-bold text-on-surface-variant border-b border-border-subtle">
                        <th className="py-3 px-5">Candidate</th>
                        <th className="py-3 px-3">Token</th>
                        <th className="py-3 px-3">Email</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Deadline</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {sessions.map((s) => (
                        <tr key={s.id}>
                          <td className="py-3.5 px-5 font-bold">{s.candidateName}</td>
                          <td className="py-3.5 px-3 font-mono text-xs">{s.token}</td>
                          <td className="py-3.5 px-3">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold">
                              <Mail className="w-3.5 h-3.5 text-primary" />
                              {s.emailDeliveryStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <StatusBadge
                              variant={
                                s.status === "report_ready" || s.status === "submitted"
                                  ? "qualified"
                                  : s.status === "revoked" || s.status === "expired"
                                    ? "failed"
                                    : "processing"
                              }
                              customLabel={s.status.replace(/_/g, " ")}
                            />
                          </td>
                          <td className="py-3.5 px-3 text-xs tabular-nums">
                            {new Date(s.deadlineAt).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-5 text-right space-x-2 whitespace-nowrap">
                            {(s.status === "report_ready" || s.status === "report_failed") && (
                              <a
                                href={routes.recruiterInterviewReport(s.applicationId)}
                                className="px-3 py-1.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold"
                              >
                                View Report
                              </a>
                            )}
                            {(s.status === "invited" || s.status === "in_progress") && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleResend(s.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border-subtle text-xs font-bold"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" /> Resend
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRevoke(s.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-status-danger/40 text-status-danger text-xs font-bold"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Revoke
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
