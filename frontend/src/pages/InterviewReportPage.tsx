import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import type {
  ApplicationRecord,
  InterviewReport,
  InterviewSession,
  JobPosting,
} from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { apiRequest } from "../lib/api";
import { getRouteParam, routes } from "../lib/navigation";

interface ReportPayload {
  application: ApplicationRecord;
  job: JobPosting | null;
  session: InterviewSession;
  report: InterviewReport | null;
}

export function InterviewReportPage() {
  const rawAppId = getRouteParam(
    "applicationId",
    /^\/recruiter\/applications\/([^/]+)/
  );
  const applicationId =
    rawAppId && rawAppId !== "interview-report" ? rawAppId : undefined;
  const { pushToast } = useToast();

  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQ, setExpandedQ] = useState<string>("q_2");
  const [recommendation, setRecommendation] = useState<
    "strong_no" | "no_hire" | "neutral" | "hire" | "strong"
  >("strong");
  const [notes, setNotes] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);

  const loadReport = () => {
    if (!applicationId) return;
    setLoading(true);
    apiRequest<ReportPayload>(
      `/api/recruiter/applications/${applicationId}/interview-report`
    )
      .then((res) => {
        setData(res);
        if (res.report?.recruiterRecommendation) {
          setRecommendation(res.report.recruiterRecommendation);
        }
        if (res.report?.recruiterNotes !== undefined) {
          setNotes(res.report.recruiterNotes);
        }
        if (res.report?.questionEvaluations[1]) {
          setExpandedQ(res.report.questionEvaluations[1].questionId);
        } else if (res.report?.questionEvaluations[0]) {
          setExpandedQ(res.report.questionEvaluations[0].questionId);
        }
      })
      .catch((err) =>
        pushToast("error", err instanceof Error ? err.message : "Could not load report.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, [applicationId]);

  const handleDecisionAction = async (
    action: "advance_panel" | "hold" | "not_selected" | "save_notes"
  ) => {
    if (!applicationId) return;
    setSavingDecision(true);
    try {
      await apiRequest(
        `/api/recruiter/applications/${applicationId}/interview-report/decision`,
        {
          method: "POST",
          body: JSON.stringify({ recommendation, notes, action }),
        }
      );
      pushToast("success", "Recruiter determination saved and audited.");
      loadReport();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to save decision.");
    } finally {
      setSavingDecision(false);
    }
  };

  const handleRetryReport = async () => {
    if (!applicationId) return;
    try {
      await apiRequest(
        `/api/recruiter/applications/${applicationId}/interview-report/retry`,
        { method: "POST" }
      );
      pushToast("success", "Interview evaluation completed.");
      loadReport();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Evaluation retry failed.");
    }
  };

  return (
    <WorkspaceShell
      title={data ? `AI Text Interview Report · ${data.application.candidateName}` : "Interview Report"}
      subtitle={data?.job ? `${data.job.title}` : "Auditable Decision Support"}
    >
      {loading ? (
        <div className="h-80 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
      ) : !data ? (
        <p className="text-sm text-status-danger">Interview report not found.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={routes.recruiterCandidateDossier(data.application.id)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Candidate Dossier</span>
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold"
            >
              Print / Export Audit View
            </button>
          </div>

          {/* Compliance & AI Ethics Banner */}
          <div className="rounded-xl bg-surface-container-low border border-primary/15 p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-on-surface-variant leading-relaxed">
              <span className="font-bold uppercase tracking-wider text-primary block mb-0.5">
                HZ-COMPLIANCE · Auditable Decision Support ·{" "}
                {data.report?.model || "gemini-4-hydrogen"}
              </span>
              <strong className="text-on-surface">AI-Assisted Assessment Notice:</strong>{" "}
              Rubric breakdowns and Zilo synthesis below are decision-support aids. Human recruiter evaluation is required for every progression or rejection.
            </div>
          </div>

          {!data.report ? (
            <div className="bg-surface-card rounded-2xl border border-border-subtle p-8 text-center space-y-4">
              <p className="font-display font-bold text-xl">
                Interview evaluation status: {data.session.status.replace("_", " ")}
              </p>
              <button
                type="button"
                onClick={handleRetryReport}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold"
              >
                <RefreshCw className="w-4 h-4" /> Run / Retry AI Report Evaluation
              </button>
            </div>
          ) : (
            <>
              {/* Hero Summary Card */}
              <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-surface-container-high text-primary font-display font-bold text-2xl flex items-center justify-center shrink-0">
                    {data.application.candidateName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display font-bold text-2xl text-on-surface">
                        {data.application.candidateName}
                      </h2>
                      <StatusBadge variant="qualified" customLabel="Completed · Audited" />
                      <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold">
                        {data.report.targetLevelLabel}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {data.job?.title} · Token:{" "}
                      <span className="font-mono">{data.session.token}</span> ·{" "}
                      {data.session.questions.length} Scenario Prompts
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="bg-paper-base rounded-xl px-5 py-3 text-center border border-border-subtle">
                    <span className="text-[11px] font-bold uppercase text-on-surface-variant block">
                      Interview Score
                    </span>
                    <span className="font-display font-bold text-3xl text-primary tabular-nums">
                      {data.report.overallInterviewScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-outline">/100</span>
                  </div>
                  <div className="bg-primary-container text-white rounded-xl px-5 py-3 text-center shadow-sm">
                    <span className="text-[11px] font-bold uppercase text-on-primary-container block">
                      ATS Cumulative
                    </span>
                    <span className="font-display font-bold text-3xl tabular-nums">
                      {data.report.atsCumulativeScore?.toFixed(1) ?? "—"}
                    </span>
                    <span className="text-xs text-on-primary-container">/100</span>
                  </div>
                </div>
              </div>

              {/* 4 Dimension Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {data.report.dimensions.map((dim) => (
                  <div
                    key={dim.name}
                    className="bg-surface-card rounded-xl border border-border-subtle p-4 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-on-surface">{dim.name}</span>
                        <span className="font-display font-bold text-lg text-primary tabular-nums">
                          {dim.score}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden mb-2">
                        <div
                          className="h-full bg-primary-container rounded-full"
                          style={{ width: `${dim.score}%` }}
                        />
                      </div>
                      <p className="text-xs text-on-surface-variant">{dim.summary}</p>
                    </div>
                    <p className="text-[11px] text-outline mt-3 tabular-nums">
                      Rubric Target: {dim.rubricTarget}%
                    </p>
                  </div>
                ))}
              </div>

              {/* 2-Col Split: Synthesis & Questions vs Action Deck */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-5">
                  {/* Zilo Copilot Synthesis */}
                  <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-bold text-lg">
                        Zilo Technical Copilot Synthesis
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold capitalize">
                        {data.report.confidence} confidence
                      </span>
                    </div>
                    <p className="text-sm text-on-surface leading-relaxed bg-paper-base p-4 rounded-xl border border-border-subtle">
                      {data.report.synthesisSummary}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-paper-base border border-border-subtle">
                        <p className="text-xs font-bold text-status-success flex items-center gap-1.5 mb-2">
                          <ThumbsUp className="w-4 h-4" /> Verified Strengths
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-on-surface-variant">
                          {data.report.verifiedStrengths.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 rounded-xl bg-paper-base border border-border-subtle">
                        <p className="text-xs font-bold text-status-warning flex items-center gap-1.5 mb-2">
                          <Lightbulb className="w-4 h-4" /> Recommended Panel Deep-Dive
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {data.report.recommendedDeepDive}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Scenario Question Audit Log */}
                  <div className="space-y-3">
                    <h3 className="font-display font-bold text-lg text-on-surface">
                      Scenario Question Audit Log ({data.report.questionEvaluations.length})
                    </h3>
                    {data.report.questionEvaluations.map((qe, idx) => {
                      const isOpen = expandedQ === qe.questionId;
                      const ansObj = data.session.answers.find(
                        (a) => a.questionId === qe.questionId
                      );
                      return (
                        <div
                          key={qe.questionId}
                          className={`bg-surface-card rounded-2xl border overflow-hidden shadow-xs ${
                            isOpen ? "border-primary/40 ring-1 ring-primary/15" : "border-border-subtle"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedQ(isOpen ? "" : qe.questionId)
                            }
                            className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-paper-base/50"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-7 h-7 rounded-full bg-primary-fixed text-primary font-mono text-xs font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-on-surface truncate">
                                  {qe.questionPrompt}
                                </p>
                                <p className="text-xs text-outline">{qe.competency}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-display font-bold text-lg text-primary tabular-nums">
                                {qe.score}
                                <span className="text-xs text-outline">/100</span>
                              </span>
                              {isOpen ? (
                                <ChevronUp className="w-4 h-4 text-outline" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-outline" />
                              )}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="p-5 pt-2 border-t border-border-subtle space-y-4">
                              <div className="flex flex-wrap gap-2 text-xs">
                                {qe.rubricChecks.map((rc) => (
                                  <span
                                    key={rc}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-status-success/12 text-status-success font-semibold"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {rc}
                                  </span>
                                ))}
                              </div>

                              <div>
                                <p className="text-[11px] font-bold uppercase text-outline mb-1">
                                  Candidate Verbatim Answer
                                </p>
                                <div className="p-4 rounded-xl bg-paper-base border border-border-subtle font-mono text-xs text-on-surface whitespace-pre-wrap leading-relaxed">
                                  {ansObj?.answerText || "[No response recorded]"}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div className="p-3 rounded-xl bg-surface-container-low">
                                  <p className="font-bold text-primary mb-1">
                                    Evaluator Evidence Note
                                  </p>
                                  <p className="text-on-surface-variant">{qe.evaluatorNote}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-surface-container-low">
                                  <p className="font-bold text-primary mb-1">
                                    Answer &amp; Portfolio Citation
                                  </p>
                                  <p className="text-on-surface-variant">
                                    {qe.portfolioCitation || qe.evidenceFromAnswer}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Recruiter Action Deck */}
                <div className="lg:col-span-4 space-y-5 sticky top-[88px]">
                  <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-outline">
                        Pipeline Stage
                      </span>
                      <StatusBadge
                        variant={
                          data.application.recruiterDecision === "pending"
                            ? "interview_invited"
                            : data.application.recruiterDecision
                        }
                      />
                    </div>
                    <h3 className="font-display font-bold text-lg text-on-surface">
                      Recruiter Action Deck
                    </h3>

                    <div>
                      <p className="text-xs font-bold mb-1.5">Overall Recommendation:</p>
                      <div className="grid grid-cols-5 gap-1 text-[11px] font-bold">
                        {(
                          [
                            ["strong_no", "Strong No"],
                            ["no_hire", "No Hire"],
                            ["neutral", "Neutral"],
                            ["hire", "Hire"],
                            ["strong", "Strong"],
                          ] as const
                        ).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setRecommendation(val)}
                            className={`py-2 rounded-lg transition-colors ${
                              recommendation === val
                                ? "bg-tertiary-fixed text-on-tertiary-fixed shadow-xs"
                                : "bg-surface-container-high text-on-surface"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="hm-notes"
                        className="block text-xs font-bold mb-1"
                      >
                        Private Recruiter / HM Notes (Internal Only)
                      </label>
                      <textarea
                        id="hm-notes"
                        rows={4}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add panel deep-dive notes or compensation alignment..."
                        className="w-full p-3 rounded-xl bg-paper-base border border-border-subtle text-xs"
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        disabled={savingDecision}
                        onClick={() => handleDecisionAction("advance_panel")}
                        className="w-full py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold hover:bg-primary"
                      >
                        Advance to Final Engineering Panel
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={savingDecision}
                          onClick={() => handleDecisionAction("save_notes")}
                          className="py-2 rounded-lg border border-border-subtle text-xs font-bold"
                        >
                          Save Notes
                        </button>
                        <button
                          type="button"
                          disabled={savingDecision}
                          onClick={() => handleDecisionAction("hold")}
                          className="py-2 rounded-lg border border-status-warning/40 text-status-warning text-xs font-bold"
                        >
                          Put On Hold
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={savingDecision}
                        onClick={() => handleDecisionAction("not_selected")}
                        className="w-full py-1.5 text-status-danger text-xs font-bold hover:underline"
                      >
                        Mark Not Selected
                      </button>
                    </div>
                  </div>

                  {/* Audit Trail */}
                  <div className="bg-surface-card rounded-2xl border border-border-subtle p-5 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                      Audit Provenance Log
                    </h4>
                    <div className="space-y-3 border-l-2 border-surface-container-high pl-3 text-xs">
                      {data.session.auditTrail.map((item, idx) => (
                        <div key={idx}>
                          <p className="font-mono text-[11px] text-outline">
                            {new Date(item.timestamp).toLocaleString()}
                          </p>
                          <p className="font-medium text-on-surface">{item.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}

