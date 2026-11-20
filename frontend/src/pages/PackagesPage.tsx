import { useState } from "react";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { PACKAGE_CATALOGUE } from "../../../shared/constants";
import { PublicFooter, PublicNavbar, WorkspaceShell } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { navigateTo, routes } from "../lib/navigation";

export function PackagesPage({ insideWorkspace = false }: { insideWorkspace?: boolean }) {
  const { user, company, refreshMe } = useAuth();
  const { pushToast } = useToast();
  const [activating, setActivating] = useState(false);

  const isHatchlingActive = company?.packageCode === "HATCHLING_FREE";

  const handleActivateHatchling = async () => {
    if (!user) {
      navigateTo(routes.signup());
      return;
    }
    if (user.role !== "recruiter") {
      pushToast("info", "Packages are activated for Recruiter company workspaces.");
      return;
    }
    if (!company) {
      pushToast("info", "Please create your Company Profile first.");
      navigateTo(routes.recruiterCompany);
      return;
    }
    setActivating(true);
    try {
      await apiRequest(`/api/companies/${company.id}/package/activate-hatchling`, {
        method: "POST",
      });
      await refreshMe();
      pushToast("success", "Hatchling (Free) package is active for your workspace.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to activate Hatchling.");
    } finally {
      setActivating(false);
    }
  };

  const content = (
    <div className={insideWorkspace ? "" : "max-w-[1320px] mx-auto px-4 sm:px-8 py-14"}>
      <div className="max-w-2xl mb-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-primary text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>HireZilla Packages</span>
        </span>
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-on-surface mt-3">
          Choose the right hiring power for your team
        </h1>
        <p className="text-sm sm:text-base text-on-surface-variant mt-2">
          Hatchling is free and active in the MVP with up to 20 applications per job. Titan and Colossus are planned future tiers — no checkout or billing is enabled yet.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {PACKAGE_CATALOGUE.map((pkg) => {
          const isHatchling = pkg.packageCode === "HATCHLING_FREE";
          return (
            <div
              key={pkg.packageCode}
              className={`rounded-2xl p-7 border flex flex-col justify-between ${
                isHatchling
                  ? "bg-surface-card border-primary shadow-md ring-2 ring-primary/15"
                  : "bg-surface-card border-border-subtle"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display font-bold text-2xl text-on-surface">
                    {pkg.displayName}
                  </h2>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      pkg.isAvailableInMvp
                        ? "bg-tertiary-fixed text-on-tertiary-fixed"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {pkg.availabilityLabel}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="font-display font-bold text-3xl text-primary">
                    {pkg.priceDisplay}
                  </p>
                  <p className="text-sm text-on-surface-variant mt-1">{pkg.tagline}</p>
                </div>

                <div className="mt-4 px-3 py-2 rounded-lg bg-paper-base border border-border-subtle text-xs font-semibold text-on-surface">
                  {pkg.maxApplicationsPerJobLabel}
                </div>

                <ul className="mt-6 space-y-2.5 text-sm">
                  {pkg.features.map((feat) => (
                    <li key={feat.label} className="flex items-start gap-2.5">
                      {feat.included ? (
                        <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
                      ) : (
                        <Lock className="w-4 h-4 text-outline shrink-0 mt-0.5" />
                      )}
                      <span
                        className={
                          feat.included ? "text-on-surface" : "text-on-surface-variant"
                        }
                      >
                        {feat.label}
                        {"plannedTier" in feat && feat.plannedTier ? (
                          <span className="ml-1.5 text-[11px] font-bold text-outline">
                            ({feat.plannedTier})
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-5 border-t border-border-subtle">
                {isHatchling ? (
                  isHatchlingActive ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-xl bg-surface-container text-primary font-bold text-sm cursor-default"
                    >
                      Current package
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={activating}
                      onClick={handleActivateHatchling}
                      className="w-full py-3 rounded-xl bg-primary-container text-white font-bold text-sm hover:bg-primary transition-colors disabled:opacity-60"
                    >
                      {activating ? "Activating..." : "Activate Hatchling"}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 rounded-xl bg-surface-container-high text-outline font-bold text-sm cursor-not-allowed"
                  >
                    Coming soon
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (insideWorkspace) {
    return (
      <WorkspaceShell
        title="Package & Entitlements"
        subtitle="Manage your Hatchling workspace entitlement"
      >
        {content}
      </WorkspaceShell>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper-base">
      <PublicNavbar />
      <main className="flex-1">{content}</main>
      <PublicFooter />
    </div>
  );
}
