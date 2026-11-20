import React, { useEffect, useState } from "react";
import { Building2, ShieldAlert } from "lucide-react";
import type { Company } from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

export function RecruiterCompanyPage() {
  const { refreshMe } = useAuth();
  const { pushToast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("11-50");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<{ company: Company | null }>("/api/companies/mine")
      .then((res) => {
        if (!res.company) return;
        setCompany(res.company);
        setName(res.company.name);
        setWebsite(res.company.website || "");
        setIndustry(res.company.industry || "");
        setSize(res.company.size || "11-50");
        setLocation(res.company.location || "");
        setDescription(res.company.description || "");
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, website, industry, size, location, description };
      const res = company
        ? await apiRequest<{ company: Company }>(`/api/companies/${company.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiRequest<{ company: Company }>("/api/companies", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      setCompany(res.company);
      await refreshMe();
      pushToast("success", "Company profile saved.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to save company profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkspaceShell
      title="Company Profile"
      subtitle="Manage public company metadata displayed on your HireZilla job listings"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-surface-card rounded-2xl border border-border-subtle p-6 sm:p-7 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <h2 className="font-display font-bold text-xl text-on-surface flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span>{company ? "Edit Company Profile" : "Create Company Profile"}</span>
            </h2>
            <StatusBadge variant="not_verified" />
          </div>

          <div className="p-3.5 rounded-xl bg-paper-base border border-border-subtle flex items-start gap-2.5 text-xs text-on-surface-variant">
            <ShieldAlert className="w-4 h-4 text-outline shrink-0 mt-0.5" />
            <span>
              Company verification is not part of the current prototype. Candidates will see this status as <strong>Not verified</strong>.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cmp-name" className="block text-xs font-bold mb-1">
                Company Name <span className="text-status-danger">*</span>
              </label>
              <input
                id="cmp-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>

            <div>
              <label htmlFor="cmp-loc" className="block text-xs font-bold mb-1">
                Location <span className="text-status-danger">*</span>
              </label>
              <input
                id="cmp-loc"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bengaluru, India"
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>

            <div>
              <label htmlFor="cmp-web" className="block text-xs font-bold mb-1">
                Website (optional)
              </label>
              <input
                id="cmp-web"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>

            <div>
              <label htmlFor="cmp-ind" className="block text-xs font-bold mb-1">
                Industry
              </label>
              <input
                id="cmp-ind"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Developer Tools, FinTech..."
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              />
            </div>

            <div>
              <label htmlFor="cmp-size" className="block text-xs font-bold mb-1">
                Company Size
              </label>
              <select
                id="cmp-size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
              >
                <option value="1-10">1–10</option>
                <option value="11-50">11–50</option>
                <option value="51-200">51–200</option>
                <option value="201-500">201–500</option>
                <option value="500+">500+</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="cmp-desc" className="block text-xs font-bold mb-1">
              About Company
            </label>
            <textarea
              id="cmp-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-sm"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-primary-container text-white text-sm font-bold hover:bg-primary disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Company Profile"}
            </button>
          </div>
        </form>

        {/* Live Candidate-Facing Card Preview */}
        <div className="lg:col-span-5 bg-surface-card rounded-2xl border border-border-subtle p-6 shadow-xs space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Candidate Listing Preview
          </p>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-bold text-xl text-on-surface">
              {name || "Your Company Name"}
            </h3>
            <StatusBadge variant="not_verified" />
          </div>
          <p className="text-xs text-on-surface-variant">
            {location || "Location"} {industry ? `· ${industry}` : ""} {size ? `· ${size} employees` : ""}
          </p>
          {website && (
            <p className="text-xs font-mono text-primary truncate">{website}</p>
          )}
          <p className="text-sm text-on-surface-variant leading-relaxed pt-2 border-t border-border-subtle">
            {description || "Company summary will appear to applicants on job detail pages."}
          </p>
        </div>
      </div>
    </WorkspaceShell>
  );
}
