import { useEffect, useState } from "react";
import {
  Award,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  MapPin,
} from "lucide-react";
import type { StudentPortfolio } from "../../../shared/types";
import { PublicFooter, PublicNavbar } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { apiRequest } from "../lib/api";
import { getRouteParam, routes } from "../lib/navigation";

export function PublicPortfolioPage() {
  const slug = getRouteParam("slug", /^\/p\/([^/]+)/);
  const [portfolio, setPortfolio] = useState<StudentPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) {
      setError("Portfolio slug missing.");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    apiRequest<{ portfolio: StudentPortfolio }>(`/api/public/portfolios/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (active) setPortfolio(res.portfolio);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Portfolio unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const copyShareUrl = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper-base">
      <PublicNavbar />

      <main className="flex-1 max-w-[1080px] w-full mx-auto px-4 sm:px-8 py-10">
        {loading ? (
          <div className="h-96 rounded-2xl bg-surface-card border border-border-subtle animate-pulse" />
        ) : error || !portfolio ? (
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-12 text-center">
            <h1 className="font-display font-bold text-2xl text-on-surface">
              Portfolio Unavailable
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              {error || "This portfolio does not exist or is currently set to private."}
            </p>
            <a
              href={routes.jobs}
              className="inline-block mt-5 px-5 py-2.5 rounded-lg bg-primary-container text-white text-sm font-bold"
            >
              Browse Open Jobs
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hero Profile Card */}
            <section className="bg-surface-card rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary-fixed text-primary font-display font-bold text-2xl flex items-center justify-center shrink-0">
                    {portfolio.displayName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-display font-bold text-2xl sm:text-3xl text-on-surface">
                        {portfolio.displayName}
                      </h1>
                      {portfolio.isDemo && <StatusBadge variant="demo" />}
                    </div>
                    {portfolio.headline && (
                      <p className="text-sm sm:text-base font-medium text-primary mt-0.5">
                        {portfolio.headline}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant mt-2">
                      {portfolio.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {portfolio.location}
                        </span>
                      )}
                      <span className="font-mono text-outline">/p/{portfolio.slug}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {portfolio.links.github && (
                    <a
                      href={portfolio.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
                    >
                      <Github className="w-4 h-4" />
                      <span>GitHub</span>
                    </a>
                  )}
                  {portfolio.links.linkedin && (
                    <a
                      href={portfolio.links.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
                    >
                      <Linkedin className="w-4 h-4" />
                      <span>LinkedIn</span>
                    </a>
                  )}
                  {portfolio.links.website && (
                    <a
                      href={portfolio.links.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
                    >
                      <Globe className="w-4 h-4" />
                      <span>Website</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={copyShareUrl}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-container text-white text-xs font-bold hover:bg-primary"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copied link" : "Share Portfolio"}</span>
                  </button>
                </div>
              </div>

              {portfolio.summary && (
                <p className="mt-5 pt-5 border-t border-border-subtle text-sm text-on-surface-variant leading-relaxed">
                  {portfolio.summary}
                </p>
              )}
            </section>

            {/* Skills */}
            <section className="bg-surface-card rounded-2xl border border-border-subtle p-6">
              <h2 className="font-display font-bold text-lg text-on-surface mb-3">
                Self-Reported Skills &amp; Core Stack
              </h2>
              <p className="text-xs text-outline mb-3">
                Skills listed below are candidate-declared and paired with project implementations below.
              </p>
              <div className="flex flex-wrap gap-2">
                {portfolio.skills.map((skill) => (
                  <span
                    key={skill.name}
                    className="px-3 py-1.5 rounded-lg bg-paper-base border border-border-subtle text-xs font-bold text-on-surface flex items-center gap-1.5"
                  >
                    <span>{skill.name}</span>
                    {skill.selfRating && (
                      <span className="text-[10px] uppercase text-primary font-semibold">
                        · {skill.selfRating}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </section>

            {/* Projects */}
            <section className="space-y-4">
              <h2 className="font-display font-bold text-xl text-on-surface flex items-center gap-2">
                <Code2 className="w-5 h-5 text-primary" />
                <span>Featured Projects ({portfolio.projects.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {portfolio.projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-surface-card rounded-2xl border border-border-subtle p-6 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-lg text-on-surface">
                          {proj.title}
                        </h3>
                        {proj.githubUrl && (
                          <a
                            href={proj.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-primary inline-flex items-center gap-1 hover:underline shrink-0"
                          >
                            <span>Repo</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                        {proj.description}
                      </p>
                      <div className="mt-3 p-3 rounded-lg bg-paper-base border border-border-subtle text-xs">
                        <span className="font-bold text-on-surface">Contribution: </span>
                        <span className="text-on-surface-variant">{proj.roleContribution}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {proj.technologies.map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-0.5 rounded bg-primary-fixed text-primary text-[11px] font-bold"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Education & Certifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <section className="bg-surface-card rounded-2xl border border-border-subtle p-6">
                <h2 className="font-display font-bold text-lg text-on-surface flex items-center gap-2 mb-4">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  <span>Education</span>
                </h2>
                <div className="space-y-4">
                  {portfolio.education.map((edu) => (
                    <div key={edu.id} className="border-l-2 border-primary/30 pl-3.5">
                      <p className="font-bold text-sm text-on-surface">
                        {edu.qualification} · {edu.fieldOfStudy}
                      </p>
                      <p className="text-xs text-on-surface-variant">{edu.institution}</p>
                      <p className="text-xs text-outline mt-0.5 tabular-nums">
                        {edu.startYear} – {edu.endYear ?? "Present"} ({edu.status})
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-surface-card rounded-2xl border border-border-subtle p-6">
                <h2 className="font-display font-bold text-lg text-on-surface flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-primary" />
                  <span>Certifications</span>
                </h2>
                {portfolio.certifications.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">
                    No certifications added.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {portfolio.certifications.map((cert) => (
                      <div key={cert.id} className="p-3 rounded-lg bg-paper-base border border-border-subtle">
                        <p className="font-bold text-sm text-on-surface">{cert.name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {cert.issuer} {cert.date ? `· ${cert.date}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
