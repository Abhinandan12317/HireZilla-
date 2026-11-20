import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { RESUME_CATEGORY_LABELS, RESUME_WEIGHTS } from "../../../shared/constants";
import type { JobEvaluationProfile, JobPosting } from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { apiRequest } from "../lib/api";
import { getRouteParam, navigateTo, routes } from "../lib/navigation";

export function JobEditorPage() {
  const rawJobId = getRouteParam("jobId", /^\/recruiter\/jobs\/([^/]+)/);
  const jobId = rawJobId && rawJobId !== "new" && rawJobId !== "edit" ? rawJobId : undefined;
  const isNew = !jobId;
  const { pushToast } = useToast();

  const [job, setJob] = useState<JobPosting | null>(null);
  const [profile, setProfile] = useState<JobEvaluationProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingProfile, setGeneratingProfile] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState<JobPosting["employmentType"]>("full_time");
  const [workMode, setWorkMode] = useState<JobPosting["workMode"]>("hybrid");
  const [location, setLocation] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [educationRequirement, setEducationRequirement] = useState("");
  const [eligibilityText, setEligibilityText] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [responsibilitiesText, setResponsibilitiesText] = useState("");
  const [requiredSkillsText, setRequiredSkillsText] = useState("");
  const [preferredSkillsText, setPreferredSkillsText] = useState("");
  const [compensationDisplay, setCompensationDisplay] = useState("");

  useEffect(() => {
    if (!jobId) return;
    apiRequest<{ job: JobPosting; activeProfile: JobEvaluationProfile | null }>(
      `/api/recruiter/jobs/${jobId}`
    ).then((res) => {
      const j = res.job;
      setJob(j);
      setProfile(res.activeProfile);
      setTitle(j.title);
      setDepartment(j.department || "");
      setEmploymentType(j.employmentType);
      setWorkMode(j.workMode);
      setLocation(j.location);
      setExperienceLevel(j.experienceLevel);
      setEducationRequirement(j.educationRequirement || "");
      setEligibilityText((j.eligibilityRequirements || []).join("\n"));
      setSummary(j.summary);
      setDescription(j.description);
      setResponsibilitiesText((j.responsibilities || []).join("\n"));
      setRequiredSkillsText((j.requiredSkills || []).join(", "));
      setPreferredSkillsText((j.preferredSkills || []).join(", "));
      setCompensationDisplay(j.compensationDisplay || "");
    });
  }, [jobId]);

  const buildPayload = () => ({
    title: title.trim(),
    department: department.trim() || undefined,
    employmentType,
    workMode,
    location: location.trim(),
    experienceLevel: experienceLevel.trim(),
    educationRequirement: educationRequirement.trim() || undefined,
    eligibilityRequirements: eligibilityText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    summary: summary.trim(),
    description: description.trim(),
    responsibilities: responsibilitiesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    requiredSkills: requiredSkillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    preferredSkills: preferredSkillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    compensationDisplay: compensationDisplay.trim() || undefined,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const res = await apiRequest<{ job: JobPosting }>("/api/recruiter/jobs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        pushToast("success", "Draft job created. Now generate the Job Evaluation Profile.");
        navigateTo(routes.recruiterJobEdit(res.job.id));
      } else {
        const res = await apiRequest<{ job: JobPosting; profileMarkedStale: boolean }>(
          `/api/recruiter/jobs/${jobId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );
        setJob(res.job);
        if (res.profileMarkedStale) {
          pushToast(
            "info",
            "JD changed — previous evaluation profile marked stale. Refresh profile before accepting new applicants."
          );
        } else {
          pushToast("success", "Job saved.");
        }
      }
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to save job.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateProfile = async () => {
    if (!job) return;
    setGeneratingProfile(true);
    setProfileError(null);
    try {
      const res = await apiRequest<{ profile: JobEvaluationProfile }>(
        `/api/jobs/${job.id}/evaluation-profile/generate`,
        { method: "POST" }
      );
      setProfile(res.profile);
      setJob((prev) =>
        prev
          ? {
              ...prev,
              activeEvaluationProfileId: res.profile.id,
              activeEvaluationProfileVersion: res.profile.profileVersion,
              evaluationProfileStatus: res.profile.status,
            }
          : prev
      );
      pushToast(
        "success",
        `Evaluation Profile v${res.profile.profileVersion} ready with ${res.profile.criteria.length} traceable criteria.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Profile generation failed.";
      setProfileError(msg);
      pushToast("error", msg);
    } finally {
      setGeneratingProfile(false);
    }
  };

  const handlePublish = async () => {
    if (!job) return;
    setPublishing(true);
    try {
      const res = await apiRequest<{ job: JobPosting }>(`/api/recruiter/jobs/${job.id}/publish`, {
        method: "POST",
      });
      setJob(res.job);
      pushToast("success", "Job published and now open for applications!");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <WorkspaceShell
      title={isNew ? "Create New Job" : `Edit Job · ${job?.title || ""}`}
      subtitle="Fixed 7-category rubric weights · Dynamic job-specific evaluation profile"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-surface-card rounded-2xl border border-border-subtle p-6 space-y-5 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <h2 className="font-display font-bold text-lg text-on-surface">
              Job Details &amp; Requirements
            </h2>
            {job && <StatusBadge variant={job.status} />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="jd-title" className="block text-xs font-bold mb-1">
                Job Title <span className="text-status-danger">*</span>
              </label>
              <input
                id="jd-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Backend Engineer (FastAPI / Distributed Systems)"
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>

            <div>
              <label htmlFor="jd-loc" className="block text-xs font-bold mb-1">
                Location <span className="text-status-danger">*</span>
              </label>
              <input
                id="jd-loc"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bengaluru, India"
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>

            <div>
              <label htmlFor="jd-exp" className="block text-xs font-bold mb-1">
                Experience Range <span className="text-status-danger">*</span>
              </label>
              <input
                id="jd-exp"
                required
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                placeholder="e.g. 2–5 years or Fresh graduates welcome"
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>

            <div>
              <label htmlFor="jd-work" className="block text-xs font-bold mb-1">
                Work Mode
              </label>
              <select
                id="jd-work"
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value as JobPosting["workMode"])}
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              >
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>

            <div>
              <label htmlFor="jd-type" className="block text-xs font-bold mb-1">
                Employment Type
              </label>
              <select
                id="jd-type"
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as JobPosting["employmentType"])
                }
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              >
                <option value="full_time">Full-time</option>
                <option value="internship">Internship</option>
                <option value="contract">Contract</option>
                <option value="part_time">Part-time</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="jd-sum" className="block text-xs font-bold mb-1">
              Role Summary <span className="text-status-danger">*</span>
            </label>
            <textarea
              id="jd-sum"
              required
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
            />
          </div>

          <div>
            <label htmlFor="jd-desc" className="block text-xs font-bold mb-1">
              Full Job Description <span className="text-status-danger">*</span>
            </label>
            <textarea
              id="jd-desc"
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="jd-req" className="block text-xs font-bold mb-1">
                Required Skills (comma-separated) <span className="text-status-danger">*</span>
              </label>
              <input
                id="jd-req"
                required
                value={requiredSkillsText}
                onChange={(e) => setRequiredSkillsText(e.target.value)}
                placeholder="Python, FastAPI, PostgreSQL"
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>

            <div>
              <label htmlFor="jd-pref" className="block text-xs font-bold mb-1">
                Preferred Skills (comma-separated)
              </label>
              <input
                id="jd-pref"
                value={preferredSkillsText}
                onChange={(e) => setPreferredSkillsText(e.target.value)}
                placeholder="Go, Kubernetes, Redis"
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="jd-edu" className="block text-xs font-bold mb-1">
                Education Requirement (leave blank if none)
              </label>
              <input
                id="jd-edu"
                value={educationRequirement}
                onChange={(e) => setEducationRequirement(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>
            <div>
              <label htmlFor="jd-comp" className="block text-xs font-bold mb-1">
                Compensation Display (optional)
              </label>
              <input
                id="jd-comp"
                value={compensationDisplay}
                onChange={(e) => setCompensationDisplay(e.target.value)}
                placeholder="₹24L – ₹36L / year"
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="jd-elig" className="block text-xs font-bold mb-1">
              Explicit Job Eligibility Conditions (one per line)
            </label>
            <textarea
              id="jd-elig"
              rows={2}
              value={eligibilityText}
              onChange={(e) => setEligibilityText(e.target.value)}
              placeholder="Authorized to work in India"
              className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
            />
          </div>

          <div className="p-3 rounded-xl bg-paper-base border border-border-subtle text-xs flex items-center justify-between">
            <span className="font-semibold text-on-surface-variant">
              Hatchling Application Cap (Read-only)
            </span>
            <span className="font-mono font-bold text-primary">20 applications / job</span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-surface-container text-primary text-xs font-bold hover:bg-primary-fixed"
            >
              {saving ? "Saving..." : isNew ? "Save Draft" : "Save Changes"}
            </button>
            {!isNew && job && job.status === "draft" && (
              <button
                type="button"
                disabled={publishing || job.evaluationProfileStatus !== "ready"}
                onClick={handlePublish}
                className="px-5 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold hover:bg-primary disabled:opacity-50"
              >
                {publishing ? "Publishing..." : "Publish Job"}
              </button>
            )}
          </div>
        </form>

        {/* Right Panel: Evaluation Profile & Fixed Rubric */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-on-surface">
                Job Evaluation Profile
              </h2>
              {job && (
                <span className="text-xs font-mono font-bold text-primary">
                  v{job.activeEvaluationProfileVersion || "0"} · {job.evaluationProfileStatus}
                </span>
              )}
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Gemini extracts traceable criteria from your JD into the 7 fixed P1 scoring categories without inventing unlisted requirements.
            </p>

            {isNew ? (
              <p className="text-xs font-semibold text-primary">
                Save the draft job first to generate its evaluation profile.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={generatingProfile}
                  onClick={handleGenerateProfile}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {generatingProfile
                      ? "Generating Criteria with Gemini..."
                      : profile
                        ? "Refresh Evaluation Profile"
                        : "Generate Evaluation Profile"}
                  </span>
                </button>

                {profileError && (
                  <div className="p-3 rounded-xl bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{profileError}</span>
                  </div>
                )}

                {profile && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-status-success flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Profile v{profile.profileVersion} ({profile.status})
                      </span>
                      <span className="text-outline">
                        {profile.criteria.length} criteria
                      </span>
                    </div>

                    {profile.ambiguities.length > 0 && (
                      <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/30 text-xs space-y-1">
                        <p className="font-bold text-status-warning">JD Ambiguities Flagged:</p>
                        <ul className="list-disc pl-4">
                          {profile.ambiguities.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                      {profile.criteria.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl bg-paper-base border border-border-subtle text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-primary">
                              {RESUME_CATEGORY_LABELS[c.category]}
                            </span>
                            <span className="uppercase font-bold text-[10px] px-2 py-0.5 rounded bg-surface-card border border-border-subtle">
                              {c.priority}
                            </span>
                          </div>
                          <p className="font-semibold text-on-surface">{c.requirement}</p>
                          <p className="text-[11px] text-outline italic">
                            Source: &ldquo;{c.sourceText}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-surface-card rounded-2xl border border-border-subtle p-5">
            <h3 className="font-display font-bold text-sm text-on-surface mb-3">
              Fixed 7-Category Weights (100%)
            </h3>
            <div className="space-y-1.5 text-xs">
              {Object.entries(RESUME_WEIGHTS).map(([k, w]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-on-surface-variant">
                    {RESUME_CATEGORY_LABELS[k as keyof typeof RESUME_CATEGORY_LABELS]}
                  </span>
                  <span className="font-mono font-bold text-on-surface">{w}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
