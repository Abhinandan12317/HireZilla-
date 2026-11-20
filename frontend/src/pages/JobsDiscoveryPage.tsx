import React, { useCallback, useEffect, useState } from "react";
import { Briefcase, MapPin, Search, SlidersHorizontal, Users } from "lucide-react";
import type { JobPosting } from "../../../shared/types";
import { PublicFooter, PublicNavbar } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { apiRequest } from "../lib/api";
import { routes } from "../lib/navigation";

export function JobsDiscoveryPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [sort, setSort] = useState("newest");

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (location.trim()) params.set("location", location.trim());
      if (workMode) params.set("workMode", workMode);
      if (employmentType) params.set("employmentType", employmentType);
      params.set("sort", sort);

      const res = await apiRequest<{ jobs: JobPosting[]; total: number }>(
        `/api/public/jobs?${params.toString()}`
      );
      setJobs(res.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, [q, location, workMode, employmentType, sort]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const clearFilters = () => {
    setQ("");
    setLocation("");
    setWorkMode("");
    setEmploymentType("");
    setSort("newest");
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper-base">
      <PublicNavbar />

      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-8 py-10">
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-on-surface">
            Open Opportunities
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Apply with your HireZilla portfolio and PDF resume. Every job displays company verification status and real applicant cap availability.
          </p>
        </div>

        {/* Search & AND Filters */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface-card rounded-2xl border border-border-subtle p-4 sm:p-5 shadow-xs mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <label
                htmlFor="job-search-q"
                className="block text-xs font-bold text-on-surface mb-1"
              >
                Role, Skill, or Company
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="job-search-q"
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="FastAPI, React, Distributed Systems..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor="job-search-loc"
                className="block text-xs font-bold text-on-surface mb-1"
              >
                Location
              </label>
              <input
                id="job-search-loc"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bengaluru, Mumbai, Remote..."
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="job-work-mode"
                className="block text-xs font-bold text-on-surface mb-1"
              >
                Work Mode
              </label>
              <select
                id="job-work-mode"
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              >
                <option value="">All modes</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="job-emp-type"
                className="block text-xs font-bold text-on-surface mb-1"
              >
                Type
              </label>
              <select
                id="job-emp-type"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              >
                <option value="">All types</option>
                <option value="full_time">Full-time</option>
                <option value="internship">Internship</option>
                <option value="contract">Contract</option>
              </select>
            </div>

            <div className="md:col-span-1">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-primary-container text-white text-sm font-bold hover:bg-primary transition-colors flex items-center justify-center gap-1"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="md:hidden">Apply Filters</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle text-xs">
            <span className="text-on-surface-variant">
              Showing <strong className="tabular-nums">{jobs.length}</strong> open listing
              {jobs.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-3">
              <label htmlFor="job-sort" className="text-on-surface-variant font-semibold">
                Sort:
              </label>
              <select
                id="job-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-2.5 py-1 rounded-md bg-paper-base border border-border-subtle text-xs font-semibold"
              >
                <option value="newest">Newest first</option>
                <option value="title_asc">Title (A–Z)</option>
              </select>
              {(q || location || workMode || employmentType) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-primary font-bold hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-52 rounded-2xl bg-surface-card border border-border-subtle animate-pulse p-6"
              />
            ))}
          </div>
        ) : error ? (
          <div className="bg-surface-card rounded-2xl border border-status-danger/30 p-8 text-center">
            <p className="font-bold text-status-danger">{error}</p>
            <button
              type="button"
              onClick={fetchJobs}
              className="mt-4 px-5 py-2 rounded-lg bg-primary-container text-white text-sm font-bold"
            >
              Retry
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-12 text-center">
            <p className="font-display font-bold text-xl text-on-surface">
              No matching open jobs found
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              Try removing location or work-mode filters to broaden your search.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 px-5 py-2.5 rounded-lg bg-primary-container text-white text-sm font-bold"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {jobs.map((job) => {
              const capReached = job.applicationCount >= job.applicationCap;
              return (
                <article
                  key={job.id}
                  className="bg-surface-card rounded-2xl border border-border-subtle p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-primary">{job.companyName}</span>
                        <StatusBadge variant="not_verified" />
                        {job.isDemo && <StatusBadge variant="demo" />}
                      </div>
                      <span className="text-xs text-outline tabular-nums">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <a
                      href={routes.jobDetail(job.id)}
                      className="font-display font-bold text-xl text-on-surface hover:text-primary transition-colors block"
                    >
                      {job.title}
                    </a>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant mt-2">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {job.location} ({job.workMode})
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" />
                        {job.experienceLevel}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Users className="w-3.5 h-3.5" />
                        {job.applicationCount}/{job.applicationCap} applicants
                      </span>
                    </div>

                    <p className="text-sm text-on-surface-variant mt-3 line-clamp-2 leading-relaxed">
                      {job.summary}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {job.requiredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2.5 py-0.5 rounded-md bg-paper-base border border-border-subtle text-xs font-semibold text-on-surface"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border-subtle flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {job.compensationDisplay || "Compensation not listed"}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={routes.jobDetail(job.id)}
                        className="px-3.5 py-2 rounded-lg border border-border-subtle text-xs font-bold text-on-surface hover:bg-paper-base"
                      >
                        Details
                      </a>
                      <a
                        href={routes.easyApply(job.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold ${
                          capReached
                            ? "bg-surface-container-high text-outline pointer-events-none"
                            : "bg-primary-container text-white hover:bg-primary"
                        }`}
                      >
                        {capReached ? "Cap Reached" : "Easy Apply"}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
