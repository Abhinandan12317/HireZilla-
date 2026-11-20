import { useEffect, useState } from "react";
import { CheckCircle2, Eye, Plus, Trash2 } from "lucide-react";
import type {
  CertificationItem,
  EducationItem,
  ProjectItem,
  SkillItem,
  StudentPortfolio,
} from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { getQueryParam, navigateTo } from "../lib/navigation";

const STEPS = [
  "Basic Profile",
  "Education",
  "Skills",
  "Projects",
  "Links & Certifications",
  "Review & Publish",
] as const;

export function StudentPortfolioBuilder() {
  const { user, portfolio, refreshMe } = useAuth();
  const { pushToast } = useToast();
  const returnTo = getQueryParam("returnTo");

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [headline, setHeadline] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [slug, setSlug] = useState("");

  const [education, setEducation] = useState<EducationItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState<"beginner" | "intermediate" | "advanced">(
    "intermediate"
  );

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [links, setLinks] = useState<{ linkedin?: string; github?: string; website?: string }>({});
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [visibility, setVisibility] = useState<"private" | "public">("private");

  useEffect(() => {
    apiRequest<{ portfolio: StudentPortfolio | null }>("/api/portfolios/me")
      .then((res) => {
        const p = res.portfolio ?? portfolio;
        if (!p) return;
        setDisplayName(p.displayName);
        setEmail(p.email);
        setHeadline(p.headline || "");
        setPhone(p.phone || "");
        setLocation(p.location || "");
        setSummary(p.summary || "");
        setSlug(p.slug || "");
        setEducation(p.education || []);
        setSkills(p.skills || []);
        setProjects(p.projects || []);
        setLinks(p.links || {});
        setCertifications(p.certifications || []);
        setVisibility(p.visibility || "private");
      })
      .catch(() => {});
  }, []);

  const persistPortfolio = async (targetVis: "private" | "public", completed: boolean) => {
    if (!displayName.trim() || !email.trim()) {
      pushToast("error", "Display name and valid email are required.");
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest<{ portfolio: StudentPortfolio }>("/api/portfolios/me", {
        method: "PUT",
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          headline: headline.trim() || undefined,
          phone: phone.trim() || undefined,
          location: location.trim() || undefined,
          summary: summary.trim() || undefined,
          slug: slug.trim() || undefined,
          education,
          skills,
          projects,
          links,
          certifications,
          visibility: targetVis,
          onboardingCompleted: completed,
        }),
      });
      setSlug(res.portfolio.slug);
      setVisibility(res.portfolio.visibility);
      await refreshMe();
      pushToast(
        "success",
        targetVis === "public"
          ? `Portfolio published at /p/${res.portfolio.slug}!`
          : "Portfolio draft saved."
      );
      if (completed && returnTo && returnTo.startsWith("/")) {
        navigateTo(returnTo);
      }
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to save portfolio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkspaceShell
      title="Candidate Onboarding & Portfolio Builder"
      subtitle="Build your shareable skills & projects portfolio"
    >
      <div className="space-y-6">
        {/* 6-step Progress Bar */}
        <div className="bg-surface-card rounded-2xl border border-border-subtle p-4 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {STEPS.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(idx)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                  step === idx
                    ? "bg-primary-container text-white"
                    : idx < step
                      ? "bg-surface-container text-primary"
                      : "bg-paper-base text-on-surface-variant"
                }`}
              >
                <span className="font-mono">{idx + 1}.</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Column */}
          <div className="lg:col-span-7 bg-surface-card rounded-2xl border border-border-subtle p-6 shadow-xs space-y-5">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="font-display font-bold text-xl">1. Basic Profile</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="pf-name"
                      className="block text-xs font-bold text-on-surface mb-1"
                    >
                      Display Name <span className="text-status-danger">*</span>
                    </label>
                    <input
                      id="pf-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pf-email"
                      className="block text-xs font-bold text-on-surface mb-1"
                    >
                      Email <span className="text-status-danger">*</span>
                    </label>
                    <input
                      id="pf-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pf-headline"
                      className="block text-xs font-bold text-on-surface mb-1"
                    >
                      Role Headline
                    </label>
                    <input
                      id="pf-headline"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Backend Engineer · FastAPI & Go"
                      className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pf-location"
                      className="block text-xs font-bold text-on-surface mb-1"
                    >
                      City / Location (optional)
                    </label>
                    <input
                      id="pf-location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Bengaluru, India"
                      className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="pf-summary"
                    className="block text-xs font-bold text-on-surface mb-1"
                  >
                    Summary
                  </label>
                  <textarea
                    id="pf-summary"
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Concise summary of engineering focus and what you build..."
                    className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-xl">2. Education</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setEducation((prev) => [
                        ...prev,
                        {
                          id: `edu_${Date.now()}`,
                          institution: "",
                          qualification: "B.Tech",
                          fieldOfStudy: "",
                          startYear: 2021,
                          endYear: 2025,
                          status: "completed",
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container text-primary text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Education</span>
                  </button>
                </div>

                {education.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">
                    Add your degree, diploma, or equivalent learning pathway.
                  </p>
                ) : (
                  education.map((edu, idx) => (
                    <div
                      key={edu.id}
                      className="p-4 rounded-xl bg-paper-base border border-border-subtle space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-primary">Entry {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEducation((prev) => prev.filter((x) => x.id !== edu.id))
                          }
                          className="text-status-danger text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          placeholder="Institution"
                          value={edu.institution}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((x) =>
                                x.id === edu.id ? { ...x, institution: e.target.value } : x
                              )
                            )
                          }
                          className="px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                        />
                        <input
                          placeholder="Qualification (e.g. B.Tech)"
                          value={edu.qualification}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((x) =>
                                x.id === edu.id ? { ...x, qualification: e.target.value } : x
                              )
                            )
                          }
                          className="px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                        />
                        <input
                          placeholder="Field of study"
                          value={edu.fieldOfStudy}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((x) =>
                                x.id === edu.id ? { ...x, fieldOfStudy: e.target.value } : x
                              )
                            )
                          }
                          className="px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                        />
                        <select
                          value={edu.status}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((x) =>
                                x.id === edu.id
                                  ? {
                                      ...x,
                                      status: e.target.value as "ongoing" | "completed",
                                    }
                                  : x
                              )
                            )
                          }
                          className="px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                        >
                          <option value="completed">Completed</option>
                          <option value="ongoing">Ongoing</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-display font-bold text-xl">3. Skills</h2>
                <p className="text-xs text-on-surface-variant">
                  List skills you can explain or demonstrate in projects or technical interviews. Self-ratings are guidance only, not verified proof.
                </p>

                <div className="flex flex-wrap gap-2">
                  <input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Add skill (e.g. FastAPI, PostgreSQL)"
                    className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                  />
                  <select
                    value={newSkillLevel}
                    onChange={(e) =>
                      setNewSkillLevel(
                        e.target.value as "beginner" | "intermediate" | "advanced"
                      )
                    }
                    className="px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSkill.trim()) return;
                      if (!skills.some((s) => s.name.toLowerCase() === newSkill.trim().toLowerCase())) {
                        setSkills((prev) => [
                          ...prev,
                          { name: newSkill.trim(), selfRating: newSkillLevel },
                        ]);
                      }
                      setNewSkill("");
                    }}
                    className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <span
                      key={s.name}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container text-xs font-bold text-primary"
                    >
                      <span>
                        {s.name} · {s.selfRating}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSkills((prev) => prev.filter((x) => x.name !== s.name))
                        }
                        className="text-status-danger"
                        aria-label={`Remove ${s.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-xl">4. Projects</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setProjects((prev) => [
                        ...prev,
                        {
                          id: `proj_${Date.now()}`,
                          title: "",
                          description: "",
                          roleContribution: "",
                          technologies: [],
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container text-primary text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Project</span>
                  </button>
                </div>

                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-4 rounded-xl bg-paper-base border border-border-subtle space-y-3"
                  >
                    <div className="flex justify-between">
                      <input
                        placeholder="Project title"
                        value={proj.title}
                        onChange={(e) =>
                          setProjects((prev) =>
                            prev.map((x) =>
                              x.id === proj.id ? { ...x, title: e.target.value } : x
                            )
                          )
                        }
                        className="flex-1 mr-2 px-3 py-1.5 rounded-lg bg-surface-card border border-border-subtle text-sm font-bold"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setProjects((prev) => prev.filter((x) => x.id !== proj.id))
                        }
                        className="text-xs font-bold text-status-danger"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="What did you build and what problem did it solve?"
                      value={proj.description}
                      onChange={(e) =>
                        setProjects((prev) =>
                          prev.map((x) =>
                            x.id === proj.id ? { ...x, description: e.target.value } : x
                          )
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                    />
                    <input
                      placeholder="Your exact role / contribution"
                      value={proj.roleContribution}
                      onChange={(e) =>
                        setProjects((prev) =>
                          prev.map((x) =>
                            x.id === proj.id
                              ? { ...x, roleContribution: e.target.value }
                              : x
                          )
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        placeholder="Technologies (comma-separated)"
                        value={proj.technologies.join(", ")}
                        onChange={(e) =>
                          setProjects((prev) =>
                            prev.map((x) =>
                              x.id === proj.id
                                ? {
                                    ...x,
                                    technologies: e.target.value
                                      .split(",")
                                      .map((t) => t.trim())
                                      .filter(Boolean),
                                  }
                                : x
                            )
                          )
                        }
                        className="px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                      />
                      <input
                        placeholder="GitHub URL (optional)"
                        value={proj.githubUrl || ""}
                        onChange={(e) =>
                          setProjects((prev) =>
                            prev.map((x) =>
                              x.id === proj.id ? { ...x, githubUrl: e.target.value } : x
                            )
                          )
                        }
                        className="px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="font-display font-bold text-xl">
                  5. Links &amp; Certifications
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  <input
                    placeholder="GitHub Profile URL (https://github.com/...)"
                    value={links.github || ""}
                    onChange={(e) => setLinks((p) => ({ ...p, github: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                  />
                  <input
                    placeholder="LinkedIn URL (https://linkedin.com/in/...)"
                    value={links.linkedin || ""}
                    onChange={(e) => setLinks((p) => ({ ...p, linkedin: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                  />
                  <input
                    placeholder="Personal Website (https://...)"
                    value={links.website || ""}
                    onChange={(e) => setLinks((p) => ({ ...p, website: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
                  />
                </div>

                <div className="pt-3 border-t border-border-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">Certifications (Optional)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCertifications((p) => [
                          ...p,
                          { id: `cert_${Date.now()}`, name: "", issuer: "" },
                        ])
                      }
                      className="text-xs font-bold text-primary"
                    >
                      + Add Certification
                    </button>
                  </div>
                  {certifications.map((c) => (
                    <div key={c.id} className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Certification Name"
                        value={c.name}
                        onChange={(e) =>
                          setCertifications((p) =>
                            p.map((x) =>
                              x.id === c.id ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-paper-base border border-border-subtle text-xs"
                      />
                      <input
                        placeholder="Issuer (e.g. CNCF, AWS)"
                        value={c.issuer}
                        onChange={(e) =>
                          setCertifications((p) =>
                            p.map((x) =>
                              x.id === c.id ? { ...x, issuer: e.target.value } : x
                            )
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-paper-base border border-border-subtle text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h2 className="font-display font-bold text-xl">6. Review &amp; Publish</h2>
                <div>
                  <label
                    htmlFor="pf-slug"
                    className="block text-xs font-bold text-on-surface mb-1"
                  >
                    Public Portfolio URL Slug
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-outline">/p/</span>
                    <input
                      id="pf-slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="your-name"
                      className="flex-1 px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-paper-base border border-border-subtle">
                  <p className="text-xs font-bold text-on-surface mb-2">Visibility</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setVisibility("private")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border ${
                        visibility === "private"
                          ? "bg-primary-fixed text-primary border-primary"
                          : "bg-surface-card text-on-surface-variant border-border-subtle"
                      }`}
                    >
                      Private Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility("public")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border ${
                        visibility === "public"
                          ? "bg-tertiary-fixed text-on-tertiary-fixed border-tertiary"
                          : "bg-surface-card text-on-surface-variant border-border-subtle"
                      }`}
                    >
                      Public Portfolio
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => persistPortfolio("private", false)}
                    className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-on-surface"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => persistPortfolio("public", true)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold hover:bg-primary"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{saving ? "Publishing..." : "Publish Public Portfolio"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step Controls */}
            <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="px-4 py-2 rounded-lg border border-border-subtle text-xs font-bold disabled:opacity-40"
              >
                Previous
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => persistPortfolio(visibility, false)}
                  className="px-4 py-2 rounded-lg bg-surface-container text-primary text-xs font-bold"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>
                {step < STEPS.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                    className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold"
                  >
                    Save &amp; Continue
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Live Portfolio Preview Column */}
          <div className="lg:col-span-5 bg-surface-card rounded-2xl border border-border-subtle p-6 shadow-xs sticky top-[88px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>Live Portfolio Preview</span>
              </span>
              <span className="text-xs font-mono text-outline">
                /p/{slug || "preview"}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-display font-bold text-xl text-on-surface">
                  {displayName || "Your Name"}
                </h3>
                <p className="text-xs font-semibold text-primary">
                  {headline || "Role headline"}
                </p>
                {location && (
                  <p className="text-xs text-outline mt-0.5">{location}</p>
                )}
              </div>

              {summary && (
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {summary}
                </p>
              )}

              <div>
                <p className="text-xs font-bold text-on-surface mb-1.5">
                  Skills ({skills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span
                      key={s.name}
                      className="px-2 py-0.5 rounded bg-paper-base border border-border-subtle text-[11px] font-semibold"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-on-surface mb-1.5">
                  Projects ({projects.length})
                </p>
                <div className="space-y-2">
                  {projects.map((pr) => (
                    <div
                      key={pr.id}
                      className="p-2.5 rounded-lg bg-paper-base border border-border-subtle text-xs"
                    >
                      <p className="font-bold text-on-surface">
                        {pr.title || "Untitled Project"}
                      </p>
                      <p className="text-on-surface-variant line-clamp-2 mt-0.5">
                        {pr.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
